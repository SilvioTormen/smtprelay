const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const encryptionService = require('./encryptionService');

/**
 * MFA Service - Persistent storage for MFA data
 * This service handles file-based persistence for MFA settings
 */
class MFAService {
  constructor() {
    this.dataPath = path.join(process.cwd(), 'data');
    this.mfaFile = path.join(this.dataPath, 'mfa.json');
    this.mfaData = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize encryption service first
      await encryptionService.initialize();
      
      // Ensure data directory exists
      await fs.mkdir(this.dataPath, { recursive: true });
      
      // Load existing MFA data
      try {
        const data = await fs.readFile(this.mfaFile, 'utf8');
        const parsed = JSON.parse(data);
        
        // Decrypt sensitive data
        for (const [userId, userData] of Object.entries(parsed)) {
          if (userData.totpSecret && typeof userData.totpSecret === 'object') {
            userData.totpSecret = encryptionService.decrypt(userData.totpSecret);
          }
          if (userData.backupCodes) {
            userData.backupCodes = userData.backupCodes.map(code => {
              if (code.code && typeof code.code === 'object') {
                return { ...code, code: encryptionService.decrypt(code.code) };
              }
              return code;
            });
          }
        }
        
        this.mfaData = new Map(Object.entries(parsed));
      } catch (error) {
        // File doesn't exist, start with empty data
        this.mfaData = new Map();
        await this.save();
      }
      
      this.initialized = true;
      console.log('✅ MFA Service initialized with encrypted persistent storage');
    } catch (error) {
      console.error('Failed to initialize MFA Service:', error);
      throw error;
    }
  }

  async save() {
    try {
      const data = {};
      
      // Encrypt sensitive data before saving
      for (const [userId, userData] of this.mfaData.entries()) {
        const encrypted = { ...userData };
        
        // Encrypt TOTP secret
        if (userData.totpSecret) {
          encrypted.totpSecret = encryptionService.encrypt(userData.totpSecret);
        }
        
        // Encrypt backup codes
        if (userData.backupCodes && userData.backupCodes.length > 0) {
          encrypted.backupCodes = userData.backupCodes.map(code => {
            if (code.code && !code.used) {
              return { ...code, code: encryptionService.encrypt(code.code) };
            }
            return code;
          });
        }
        
        data[userId] = encrypted;
      }
      
      await fs.writeFile(this.mfaFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to save MFA data:', error);
      throw error;
    }
  }

  async getUserMFA(userId) {
    await this.initialize();
    return this.mfaData.get(String(userId)) || {
      totpSecret: null,
      totpEnabled: false,
      fido2Devices: [],
      fido2Enabled: false,
      backupCodes: [],
      mfaEnforced: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async setUserMFA(userId, mfaConfig) {
    await this.initialize();
    const existing = await this.getUserMFA(userId);
    const updated = {
      ...existing,
      ...mfaConfig,
      updatedAt: new Date().toISOString()
    };
    this.mfaData.set(String(userId), updated);
    await this.save();
    return updated;
  }

  async enableTOTP(userId, secret) {
    return await this.setUserMFA(userId, {
      totpSecret: secret,
      totpEnabled: true
    });
  }

  async disableTOTP(userId) {
    return await this.setUserMFA(userId, {
      totpSecret: null,
      totpEnabled: false
    });
  }

  async addFIDO2Device(userId, device) {
    const mfa = await this.getUserMFA(userId);
    const devices = mfa.fido2Devices || [];
    devices.push({
      ...device,
      id: crypto.randomBytes(16).toString('hex'),
      createdAt: new Date().toISOString()
    });
    return await this.setUserMFA(userId, {
      fido2Devices: devices,
      fido2Enabled: true
    });
  }

  async removeFIDO2Device(userId, deviceId) {
    const mfa = await this.getUserMFA(userId);
    const devices = (mfa.fido2Devices || []).filter(d => d.id !== deviceId);
    return await this.setUserMFA(userId, {
      fido2Devices: devices,
      fido2Enabled: devices.length > 0
    });
  }

  async getFIDO2Devices(userId) {
    const mfa = await this.getUserMFA(userId);
    return mfa.fido2Devices || [];
  }

  async generateBackupCodes(userId, count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push({
        code: this.hashCode(code),
        used: false,
        createdAt: new Date().toISOString()
      });
    }
    await this.setUserMFA(userId, { backupCodes: codes });
    // Return unhashed codes for display to user
    return codes.map((c, i) => {
      const plainCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes[i].code = this.hashCode(plainCode);
      return plainCode;
    });
  }

  async verifyBackupCode(userId, code) {
    const mfa = await this.getUserMFA(userId);
    const hashedCode = this.hashCode(code);
    
    const codeIndex = (mfa.backupCodes || []).findIndex(
      c => !c.used && c.code === hashedCode
    );
    
    if (codeIndex === -1) {
      return false;
    }
    
    // Mark code as used
    mfa.backupCodes[codeIndex].used = true;
    mfa.backupCodes[codeIndex].usedAt = new Date().toISOString();
    await this.setUserMFA(userId, { backupCodes: mfa.backupCodes });
    
    return true;
  }

  async getRemainingBackupCodes(userId) {
    const mfa = await this.getUserMFA(userId);
    return (mfa.backupCodes || []).filter(c => !c.used).length;
  }

  hashCode(code) {
    return crypto
      .createHash('sha256')
      .update(code + (process.env.MFA_SALT || 'default-salt'))
      .digest('hex');
  }

  async enforceMFA(userId, enforce = true) {
    return await this.setUserMFA(userId, { mfaEnforced: enforce });
  }

  async isMFAEnabled(userId) {
    const mfa = await this.getUserMFA(userId);
    return mfa.totpEnabled || mfa.fido2Enabled;
  }

  async isMFAEnforced(userId) {
    const mfa = await this.getUserMFA(userId);
    return mfa.mfaEnforced;
  }
}

// Export singleton instance
module.exports = new MFAService();