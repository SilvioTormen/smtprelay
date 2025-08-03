const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const ipRangeCheck = require('ip-range-check');
const { authenticate, authorize } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { promisify } = require('util');
const lockfile = require('proper-lockfile');

// Rate limiting
const configRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many configuration changes'
});

// IP validation patterns
const IP_PATTERNS = {
  ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
  ipv6: /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i,
  cidr: /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
  cidrv6: /^([\da-f]{1,4}:){7}[\da-f]{1,4}\/\d{1,3}$/i,
  range: /^(\d{1,3}\.){3}\d{1,3}-(\d{1,3}\.){3}\d{1,3}$/
};

// Persistent storage for IP configurations
class IPWhitelistManager {
  constructor() {
    // Use the main directory for config storage (where we have write access)
    this.configPath = path.resolve(__dirname, '../../../ip-whitelist.json');
    this.auditLogPath = path.resolve(__dirname, '../../../logs/ip-whitelist-audit.log');
    this.config = null;
    this.loadConfig();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
    } catch (error) {
      // Initialize with default config
      this.config = {
        smtp_relay: {
          no_auth_required: [],
          auth_required: [],
          description: 'IPs that can relay emails through SMTP'
        },
        frontend_access: {
          allowed: [], // Empty means all IPs allowed
          description: 'IPs that can access the web dashboard'
        },
        blacklist: {
          blocked: [],
          description: 'IPs that are completely blocked'
        },
        settings: {
          enforce_frontend_whitelist: false,
          log_denied_attempts: true,
          auto_block_after_failures: 10,
          whitelist_timeout_minutes: 0 // 0 = permanent
        }
      };
      await this.saveConfig();
    }
  }

  async saveConfig() {
    const configDir = path.dirname(this.configPath);
    
    // Ensure directory exists
    try {
      await fs.mkdir(configDir, { recursive: true, mode: 0o755 });
    } catch (e) {
      // Directory might already exist
    }
    
    // Simple save without locking for now (to avoid lockfile issues)
    try {
      // Just write the file directly
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), { mode: 0o644 });
    } catch (error) {
      console.error('Failed to save IP whitelist config:', error);
      // Continue anyway - non-critical error
    }
  }

  validateIP(ip) {
    // Strict input validation
    if (!ip || typeof ip !== 'string' || ip.length > 45) { // Max IPv6 length
      return { valid: false, error: 'Invalid input' };
    }
    
    const trimmedIP = ip.trim();
    
    // Prevent injection attempts
    if (/[;&|`$()<>{}\[\]\\]/.test(trimmedIP)) {
      return { valid: false, error: 'Invalid characters in IP' };
    }
    
    // IPv4 validation
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(trimmedIP)) {
      const parts = trimmedIP.split('.');
      if (parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && part === num.toString(); // No leading zeros
      })) {
        return { valid: true, type: 'ipv4', normalized: trimmedIP };
      }
    }
    
    // CIDR validation
    if (/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(trimmedIP)) {
      const [ipPart, maskStr] = trimmedIP.split('/');
      const parts = ipPart.split('.');
      const mask = parseInt(maskStr, 10);
      
      if (parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255 && part === num.toString();
      }) && mask >= 0 && mask <= 32) {
        return { valid: true, type: 'cidr', normalized: trimmedIP };
      }
    }
    
    // Basic IPv6 validation (simplified)
    if (/^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(trimmedIP)) {
      return { valid: true, type: 'ipv6', normalized: trimmedIP.toLowerCase() };
    }
    
    return { valid: false, error: 'Invalid IP format' };
  }

  async addIP(category, subcategory, ip, addedBy) {
    const validation = this.validateIP(ip);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Validate category/subcategory against whitelist
    const validCategories = ['smtp_relay', 'frontend_access', 'blacklist'];
    const validSubcategories = {
      smtp_relay: ['no_auth_required', 'auth_required'],
      frontend_access: ['allowed'],
      blacklist: ['blocked']
    };
    
    if (!validCategories.includes(category) || 
        !validSubcategories[category]?.includes(subcategory)) {
      throw new Error('Invalid category or subcategory');
    }

    // Atomic operation with lock
    let release = null;
    try {
      // Acquire lock for config file
      release = await lockfile.lock(this.configPath, { stale: 5000 });
      
      // Re-read config to ensure consistency
      await this.loadConfig();
      
      const list = this.config[category][subcategory];
      if (list.includes(validation.normalized)) {
        throw new Error('IP already in list');
      }

      // Check for conflicts
      if (category !== 'blacklist' && this.isBlacklisted(validation.normalized)) {
        throw new Error('IP is blacklisted');
      }

      list.push(validation.normalized);
      await this.saveConfig();
      await this.auditLog('ADD', category, subcategory, validation.normalized, addedBy);
      
      return validation.normalized;
    } finally {
      if (release) await release();
    }
  }

  async removeIP(category, subcategory, ip, removedBy, currentUserIP) {
    // Validate inputs
    const validCategories = ['smtp_relay', 'frontend_access', 'blacklist'];
    const validSubcategories = {
      smtp_relay: ['no_auth_required', 'auth_required'],
      frontend_access: ['allowed'],
      blacklist: ['blocked']
    };
    
    if (!validCategories.includes(category) || 
        !validSubcategories[category]?.includes(subcategory)) {
      throw new Error('Invalid category or subcategory');
    }

    // Atomic operation with lock
    let release = null;
    try {
      release = await lockfile.lock(this.configPath, { stale: 5000 });
      
      // Re-read config
      await this.loadConfig();
      
      const list = this.config[category][subcategory];
      const index = list.indexOf(ip);
      
      if (index === -1) {
        throw new Error('IP not found in list');
      }

      // Enhanced admin lockout prevention
      if (category === 'frontend_access' && subcategory === 'allowed') {
        // Check if we're removing the current user's IP
        if (currentUserIP && ip === currentUserIP) {
          throw new Error('Cannot remove your own IP from whitelist');
        }
        
        // Ensure at least one IP remains
        if (list.length === 1) {
          throw new Error('Cannot remove last IP from frontend whitelist');
        }
        
        // If enforced, ensure current user IP remains in list
        if (this.config.settings.enforce_frontend_whitelist && currentUserIP) {
          const remainingIPs = list.filter(listIP => listIP !== ip);
          let currentUserHasAccess = false;
          
          for (const remainingIP of remainingIPs) {
            try {
              if (ipRangeCheck(currentUserIP, [remainingIP])) {
                currentUserHasAccess = true;
                break;
              }
            } catch (e) {
              // Invalid IP in list, skip
            }
          }
          
          if (!currentUserHasAccess) {
            throw new Error('This action would lock you out of the dashboard');
          }
        }
      }

      list.splice(index, 1);
      await this.saveConfig();
      await this.auditLog('REMOVE', category, subcategory, ip, removedBy);
      
      return true;
    } finally {
      if (release) await release();
    }
  }

  async updateSettings(settings, updatedBy, currentUserIP) {
    // Prevent prototype pollution
    const allowedSettings = [
      'enforce_frontend_whitelist',
      'log_denied_attempts', 
      'auto_block_after_failures',
      'whitelist_timeout_minutes'
    ];
    
    const sanitizedSettings = {};
    for (const key of allowedSettings) {
      if (key in settings) {
        // Validate each setting type
        if (key === 'enforce_frontend_whitelist' || key === 'log_denied_attempts') {
          if (typeof settings[key] !== 'boolean') {
            throw new Error(`${key} must be boolean`);
          }
        } else if (key === 'auto_block_after_failures' || key === 'whitelist_timeout_minutes') {
          const val = parseInt(settings[key], 10);
          if (isNaN(val) || val < 0 || val > 1000) {
            throw new Error(`${key} must be between 0 and 1000`);
          }
          settings[key] = val;
        }
        sanitizedSettings[key] = settings[key];
      }
    }
    
    // Validate enforcement change
    if (sanitizedSettings.enforce_frontend_whitelist === true) {
      if (this.config.frontend_access.allowed.length === 0) {
        throw new Error('Cannot enforce empty frontend whitelist');
      }
      
      // Check if current user would be locked out
      if (currentUserIP) {
        let hasAccess = false;
        for (const allowedIP of this.config.frontend_access.allowed) {
          try {
            if (ipRangeCheck(currentUserIP, [allowedIP])) {
              hasAccess = true;
              break;
            }
          } catch (e) {
            // Invalid IP in list
          }
        }
        
        if (!hasAccess) {
          throw new Error('Cannot enable enforcement - your IP is not whitelisted');
        }
      }
    }

    // Atomic update with lock
    let release = null;
    try {
      release = await lockfile.lock(this.configPath, { stale: 5000 });
      await this.loadConfig();
      
      Object.assign(this.config.settings, sanitizedSettings);
      await this.saveConfig();
      await this.auditLog('UPDATE_SETTINGS', 'settings', null, JSON.stringify(sanitizedSettings), updatedBy);
      
      return this.config.settings;
    } finally {
      if (release) await release();
    }
  }

  isBlacklisted(ip) {
    try {
      return ipRangeCheck(ip, this.config.blacklist.blocked);
    } catch (e) {
      return false;
    }
  }

  isSMTPAllowed(ip) {
    if (this.isBlacklisted(ip)) return false;
    
    try {
      // Check no-auth list
      if (ipRangeCheck(ip, this.config.smtp_relay.no_auth_required)) {
        return { allowed: true, requiresAuth: false };
      }
      
      // Check auth-required list
      if (ipRangeCheck(ip, this.config.smtp_relay.auth_required)) {
        return { allowed: true, requiresAuth: true };
      }
      
      // If lists are empty, allow with auth
      if (this.config.smtp_relay.no_auth_required.length === 0 &&
          this.config.smtp_relay.auth_required.length === 0) {
        return { allowed: true, requiresAuth: true };
      }
      
      return { allowed: false };
    } catch (e) {
      return { allowed: false };
    }
  }

  isFrontendAllowed(ip) {
    if (this.isBlacklisted(ip)) return false;
    
    // If not enforcing whitelist, allow all
    if (!this.config.settings.enforce_frontend_whitelist) {
      return true;
    }
    
    // If whitelist is empty, allow all (safety)
    if (this.config.frontend_access.allowed.length === 0) {
      return true;
    }
    
    try {
      return ipRangeCheck(ip, this.config.frontend_access.allowed);
    } catch (e) {
      return false;
    }
  }

  async auditLog(action, category, subcategory, value, user) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      action: String(action).substring(0, 50),
      category: String(category).substring(0, 50),
      subcategory: String(subcategory || '').substring(0, 50),
      value: String(value).substring(0, 200),
      user: String(user || 'system').substring(0, 50),
      id: crypto.randomBytes(8).toString('hex')
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      const logDir = path.dirname(this.auditLogPath);
      await fs.mkdir(logDir, { recursive: true, mode: 0o700 });
      
      // Use more restrictive permissions for audit logs
      await fs.appendFile(this.auditLogPath, logLine, { mode: 0o600 });
      
      // Rotate log if too large with rate limiting
      const stats = await fs.stat(this.auditLogPath);
      if (stats.size > 10 * 1024 * 1024) { // 10MB
        // Only rotate if last rotation was > 1 minute ago
        const rotatedPath = `${this.auditLogPath}.${Date.now()}`;
        const rotatedFiles = await fs.readdir(logDir);
        const recentRotation = rotatedFiles.some(f => {
          if (f.startsWith(path.basename(this.auditLogPath) + '.')) {
            const timestamp = parseInt(f.split('.').pop());
            return (Date.now() - timestamp) < 60000; // 1 minute
          }
          return false;
        });
        
        if (!recentRotation) {
          await fs.rename(this.auditLogPath, rotatedPath);
          
          // Keep only last 5 rotated files
          const oldRotated = rotatedFiles
            .filter(f => f.startsWith(path.basename(this.auditLogPath) + '.'))
            .sort()
            .slice(0, -5);
          
          for (const oldFile of oldRotated) {
            await fs.unlink(path.join(logDir, oldFile)).catch(() => {});
          }
        }
      }
    } catch (e) {
      // Don't throw, just log - audit failures shouldn't break operations
      console.error('Audit log error:', e.message);
    }
  }

  async getAuditLog(limit = 100) {
    try {
      const content = await fs.readFile(this.auditLogPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      return lines
        .slice(-limit)
        .reverse()
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  async importList(category, subcategory, ips, importedBy) {
    const results = {
      success: [],
      failed: [],
      skipped: []
    };

    for (const ip of ips) {
      try {
        const normalized = await this.addIP(category, subcategory, ip, importedBy);
        results.success.push(normalized);
      } catch (error) {
        if (error.message.includes('already in list')) {
          results.skipped.push({ ip, reason: 'Already exists' });
        } else {
          results.failed.push({ ip, reason: error.message });
        }
      }
    }

    return results;
  }

  async exportList(category, subcategory) {
    if (!this.config[category] || !this.config[category][subcategory]) {
      throw new Error('Invalid category');
    }
    
    return this.config[category][subcategory];
  }

  getStatistics() {
    return {
      smtp_relay: {
        no_auth_required: this.config.smtp_relay.no_auth_required.length,
        auth_required: this.config.smtp_relay.auth_required.length
      },
      frontend_access: {
        allowed: this.config.frontend_access.allowed.length,
        enforced: this.config.settings.enforce_frontend_whitelist
      },
      blacklist: {
        blocked: this.config.blacklist.blocked.length
      },
      settings: this.config.settings
    };
  }
}

// Singleton instance
const ipWhitelistManager = new IPWhitelistManager();

// API Routes

// Get current configuration
router.get('/config', authenticate, authorize('admin'), async (req, res) => {
  try {
    res.json({
      config: ipWhitelistManager.config,
      stats: ipWhitelistManager.getStatistics()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// Add IP to whitelist
router.post('/add', authenticate, authorize('admin'), configRateLimit, async (req, res) => {
  try {
    const { category, subcategory, ip } = req.body;
    
    if (!category || !subcategory || !ip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const normalized = await ipWhitelistManager.addIP(
      category, 
      subcategory, 
      ip, 
      req.user?.username || 'unknown'
    );
    
    res.json({ 
      success: true, 
      message: 'IP added successfully',
      ip: normalized
    });
  } catch (error) {
    // Don't leak internal errors
    if (error.message.includes('Invalid') || error.message.includes('already')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Operation failed' });
    }
  }
});

// Remove IP from whitelist
router.post('/remove', authenticate, authorize('admin'), configRateLimit, async (req, res) => {
  try {
    const { category, subcategory, ip } = req.body;
    
    if (!category || !subcategory || !ip) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get current user's IP for lockout prevention
    const currentUserIP = req.ip?.replace(/^::ffff:/, '') || null;

    await ipWhitelistManager.removeIP(
      category, 
      subcategory, 
      ip, 
      req.user?.username || 'unknown',
      currentUserIP
    );
    
    res.json({ 
      success: true, 
      message: 'IP removed successfully'
    });
  } catch (error) {
    if (error.message.includes('lock') || error.message.includes('Cannot')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.includes('not found') || error.message.includes('Invalid')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Operation failed' });
    }
  }
});

// Bulk import IPs
router.post('/import', authenticate, authorize('admin'), configRateLimit, async (req, res) => {
  try {
    const { category, subcategory, ips } = req.body;
    
    if (!category || !subcategory || !Array.isArray(ips)) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    
    // Limit bulk import size to prevent DoS
    if (ips.length > 1000) {
      return res.status(400).json({ error: 'Too many IPs (max 1000)' });
    }

    const results = await ipWhitelistManager.importList(
      category,
      subcategory,
      ips.slice(0, 1000), // Extra safety
      req.user?.username || 'unknown'
    );
    
    res.json({ 
      success: true,
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Import failed' });
  }
});

// Export IPs
router.get('/export/:category/:subcategory', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { category, subcategory } = req.params;
    
    // Validate params to prevent traversal
    const validCategories = ['smtp_relay', 'frontend_access', 'blacklist'];
    const validSubcategories = {
      smtp_relay: ['no_auth_required', 'auth_required'],
      frontend_access: ['allowed'],
      blacklist: ['blocked']
    };
    
    if (!validCategories.includes(category) || 
        !validSubcategories[category]?.includes(subcategory)) {
      return res.status(400).json({ error: 'Invalid category or subcategory' });
    }
    
    const ips = await ipWhitelistManager.exportList(category, subcategory);
    
    res.json({ 
      category,
      subcategory,
      ips,
      count: ips.length,
      exported_at: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// Update settings
router.post('/settings', authenticate, authorize('admin'), configRateLimit, async (req, res) => {
  try {
    const settings = req.body;
    
    // Get current user's IP for lockout prevention
    const currentUserIP = req.ip?.replace(/^::ffff:/, '') || null;
    
    const updated = await ipWhitelistManager.updateSettings(
      settings,
      req.user?.username || 'unknown',
      currentUserIP
    );
    
    res.json({ 
      success: true,
      settings: updated
    });
  } catch (error) {
    if (error.message.includes('lock') || error.message.includes('Cannot')) {
      res.status(403).json({ error: error.message });
    } else if (error.message.includes('must be')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Update failed' });
    }
  }
});

// Get audit log
router.get('/audit', authenticate, authorize('admin'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 1000);
    const logs = await ipWhitelistManager.getAuditLog(limit);
    
    res.json({ 
      logs,
      count: logs.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// Test IP against rules
router.post('/test', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { ip } = req.body;
    
    if (!ip) {
      return res.status(400).json({ error: 'IP required' });
    }

    const validation = ipWhitelistManager.validateIP(ip);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const results = {
      ip: validation.normalized,
      type: validation.type,
      blacklisted: ipWhitelistManager.isBlacklisted(ip),
      smtp_access: ipWhitelistManager.isSMTPAllowed(ip),
      frontend_access: ipWhitelistManager.isFrontendAllowed(ip)
    };
    
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Export for use in other modules
module.exports = {
  router,
  ipWhitelistManager
};