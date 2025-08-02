const ipRangeCheck = require('ip-range-check');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Rate limiting for auth attempts
const authAttempts = new Map();
const AUTH_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

class AuthHandler {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.staticUsers = this.loadStaticUsers();
  }
  
  loadStaticUsers() {
    const users = new Map();
    
    if (this.config.legacy_auth?.static_users) {
      this.config.legacy_auth.static_users.forEach(user => {
        // Hash passwords if they're plaintext (migration)
        const hashedPassword = this.isHashed(user.password) 
          ? user.password 
          : this.hashPasswordSync(user.password);
          
        users.set(user.username, {
          password: hashedPassword,
          allowedIps: user.allowed_ips || []
        });
      });
    }
    
    return users;
  }
  
  // Check if password is already hashed
  isHashed(password) {
    // bcrypt hashes start with $2a$, $2b$, or $2y$
    return /^\$2[aby]\$/.test(password);
  }
  
  // Simple sync hash for migration (use bcrypt in production)
  hashPasswordSync(password) {
    // For migration purposes - should use bcrypt in production
    return '$2b$' + crypto
      .createHash('sha256')
      .update(password + (this.config.auth?.salt || 'smtp-relay'))
      .digest('base64');
  }
  
  // Constant-time string comparison to prevent timing attacks
  timingSafeCompare(a, b) {
    if (a.length !== b.length) {
      // Still need to compare to prevent timing on length
      const bufA = Buffer.from(a);
      const bufB = Buffer.alloc(a.length);
      crypto.timingSafeEqual(bufA, bufB);
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }
  
  // Check rate limiting
  checkRateLimit(identifier) {
    const now = Date.now();
    const key = `auth_${identifier}`;
    
    // Clean old entries
    for (const [k, v] of authAttempts.entries()) {
      if (now - v.firstAttempt > AUTH_WINDOW) {
        authAttempts.delete(k);
      }
    }
    
    const attempts = authAttempts.get(key) || { count: 0, firstAttempt: now };
    
    if (now - attempts.firstAttempt > AUTH_WINDOW) {
      // Reset window
      attempts.count = 1;
      attempts.firstAttempt = now;
    } else {
      attempts.count++;
    }
    
    authAttempts.set(key, attempts);
    
    if (attempts.count > MAX_ATTEMPTS) {
      this.logger.warn(`Rate limit exceeded for ${identifier}`);
      return false;
    }
    
    return true;
  }
  
  checkIPAccess(clientIP, listener) {
    // Validate IP format first
    if (!clientIP || typeof clientIP !== 'string') {
      return false;
    }
    
    // Normalize IPv6 addresses
    const normalizedIP = clientIP.replace(/^::ffff:/, '');
    
    // Check blacklist first
    if (this.config.ip_whitelist?.blacklist?.length > 0) {
      try {
        if (ipRangeCheck(normalizedIP, this.config.ip_whitelist.blacklist)) {
          this.logger.warn(`IP ${normalizedIP} is blacklisted`);
          return false;
        }
      } catch (e) {
        this.logger.error(`Invalid blacklist configuration: ${e.message}`);
        return false;
      }
    }
    
    // For port 25, check if IP is in no-auth whitelist
    if (listener.port === 25 && this.config.ip_whitelist?.no_auth_required) {
      try {
        if (ipRangeCheck(normalizedIP, this.config.ip_whitelist.no_auth_required)) {
          this.logger.info(`IP ${normalizedIP} allowed without auth on port 25`);
          return true;
        }
      } catch (e) {
        this.logger.error(`Invalid whitelist configuration: ${e.message}`);
      }
    }
    
    // If no specific whitelist, allow all (except blacklisted)
    return true;
  }
  
  async authenticate(auth, session, callback, listener) {
    const clientIP = session.remoteAddress?.replace(/^::ffff:/, '') || 'unknown';
    const username = String(auth.username || '').substring(0, 100); // Limit length
    const password = String(auth.password || '');
    
    // Rate limiting by IP
    if (!this.checkRateLimit(clientIP)) {
      this.logger.warn(`Rate limit exceeded for IP ${clientIP}`);
      // Add random delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      return callback(new Error('Too many authentication attempts'));
    }
    
    // Rate limiting by username
    if (username && !this.checkRateLimit(username)) {
      this.logger.warn(`Rate limit exceeded for user ${username}`);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      return callback(new Error('Too many authentication attempts'));
    }
    
    this.logger.info(`Auth attempt from ${clientIP} as ${username} on port ${listener.port}`);
    
    // Check if this IP needs auth at all
    if (this.config.ip_whitelist?.no_auth_required) {
      try {
        if (ipRangeCheck(clientIP, this.config.ip_whitelist.no_auth_required)) {
          this.logger.info(`IP ${clientIP} bypassed auth - whitelisted`);
          return callback(null, { user: 'ip-whitelist' });
        }
      } catch (e) {
        this.logger.error(`IP check failed: ${e.message}`);
      }
    }
    
    // Validate against static users
    if (this.staticUsers.has(username)) {
      const user = this.staticUsers.get(username);
      
      // Use constant-time comparison for passwords
      const passwordMatch = this.isHashed(user.password)
        ? this.timingSafeCompare(this.hashPasswordSync(password), user.password)
        : this.timingSafeCompare(password, user.password);
      
      if (!passwordMatch) {
        this.logger.warn(`Invalid password for user ${username} from ${clientIP}`);
        if (this.config.logging?.log_auth_failures) {
          await this.logAuthFailure(username, clientIP, 'invalid_password');
        }
        // Add delay to prevent brute force
        await new Promise(resolve => setTimeout(resolve, 1000));
        return callback(new Error('Invalid credentials'));
      }
      
      // Check IP restrictions for this user
      if (user.allowedIps.length > 0) {
        try {
          if (!ipRangeCheck(clientIP, user.allowedIps)) {
            this.logger.warn(`User ${username} not allowed from IP ${clientIP}`);
            if (this.config.logging?.log_auth_failures) {
              await this.logAuthFailure(username, clientIP, 'ip_not_allowed');
            }
            return callback(new Error('Access denied from this IP'));
          }
        } catch (e) {
          this.logger.error(`IP validation failed: ${e.message}`);
          return callback(new Error('Authentication error'));
        }
      }
      
      this.logger.info(`Successful auth for ${username} from ${clientIP}`);
      
      // Clear rate limit on success
      authAttempts.delete(`auth_${username}`);
      authAttempts.delete(`auth_${clientIP}`);
      
      return callback(null, { user: username });
    }
    
    // No legacy fallback for security
    this.logger.warn(`Unknown user ${username} from ${clientIP}`);
    if (this.config.logging?.log_auth_failures) {
      await this.logAuthFailure(username, clientIP, 'unknown_user');
    }
    
    // Add delay to prevent user enumeration
    await new Promise(resolve => setTimeout(resolve, 1000));
    callback(new Error('Invalid credentials'));
  }
  
  async logAuthFailure(username, ip, reason) {
    const timestamp = new Date().toISOString();
    const sanitizedUsername = username.replace(/[\r\n]/g, '');
    const sanitizedIP = ip.replace(/[\r\n]/g, '');
    const logEntry = `${timestamp} AUTH_FAILURE user=${sanitizedUsername} ip=${sanitizedIP} reason=${reason}\n`;
    
    // Use async file operations
    if (this.config.logging?.auth_failure_log) {
      try {
        const logPath = path.resolve(this.config.logging.auth_failure_log);
        
        // Ensure log directory exists
        await fs.mkdir(path.dirname(logPath), { recursive: true });
        
        // Append to log file asynchronously
        await fs.appendFile(logPath, logEntry, { mode: 0o640 });
        
        // Rotate log if too large (10MB)
        const stats = await fs.stat(logPath);
        if (stats.size > 10 * 1024 * 1024) {
          const rotatedPath = `${logPath}.${Date.now()}`;
          await fs.rename(logPath, rotatedPath);
          
          // Keep only last 5 rotated logs
          const dir = path.dirname(logPath);
          const basename = path.basename(logPath);
          const files = await fs.readdir(dir);
          const rotatedFiles = files
            .filter(f => f.startsWith(basename + '.'))
            .sort()
            .reverse();
          
          for (let i = 5; i < rotatedFiles.length; i++) {
            await fs.unlink(path.join(dir, rotatedFiles[i]));
          }
        }
      } catch (e) {
        this.logger.error(`Failed to log auth failure: ${e.message}`);
      }
    }
  }
}

module.exports = { AuthHandler };