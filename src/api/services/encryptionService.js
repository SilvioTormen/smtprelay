const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class EncryptionService {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyFile = path.join(process.cwd(), 'data', '.encryption.key');
    this.key = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.keyFile);
      await fs.mkdir(dataDir, { recursive: true });

      // Try to load existing key
      try {
        const keyData = await fs.readFile(this.keyFile, 'utf8');
        this.key = Buffer.from(keyData, 'hex');
        console.log('✅ Loaded existing encryption configuration');
      } catch (error) {
        // Generate new key if not exists
        this.key = crypto.randomBytes(32);
        await fs.writeFile(this.keyFile, this.key.toString('hex'), {
          mode: 0o600 // Read/write for owner only
        });
        console.log('🔐 Generated new encryption configuration');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize encryption service:', error);
      throw error;
    }
  }

  /**
   * Encrypt sensitive data
   * @param {string} text - Plain text to encrypt
   * @returns {object} - Encrypted data with IV and auth tag
   */
  encrypt(text) {
    if (!this.initialized) {
      throw new Error('Encryption service not initialized');
    }

    if (!text) return null;

    // Generate random IV
    const iv = crypto.randomBytes(16);
    
    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt sensitive data
   * @param {object} encryptedData - Object with encrypted, iv, and authTag
   * @returns {string} - Decrypted plain text
   */
  decrypt(encryptedData) {
    if (!this.initialized) {
      throw new Error('Encryption service not initialized');
    }

    if (!encryptedData || !encryptedData.encrypted) return null;

    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        Buffer.from(encryptedData.iv, 'hex')
      );

      // Set auth tag
      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error.message);
      return null;
    }
  }

  /**
   * Encrypt an object's sensitive fields
   * @param {object} obj - Object to encrypt
   * @param {array} fields - Array of field names to encrypt
   * @returns {object} - Object with encrypted fields
   */
  encryptObject(obj, fields) {
    if (!obj) return obj;

    const encrypted = { ...obj };
    
    for (const field of fields) {
      if (obj[field]) {
        encrypted[field] = this.encrypt(obj[field]);
      }
    }

    return encrypted;
  }

  /**
   * Decrypt an object's sensitive fields
   * @param {object} obj - Object to decrypt
   * @param {array} fields - Array of field names to decrypt
   * @returns {object} - Object with decrypted fields
   */
  decryptObject(obj, fields) {
    if (!obj) return obj;

    const decrypted = { ...obj };
    
    for (const field of fields) {
      if (obj[field]) {
        decrypted[field] = this.decrypt(obj[field]);
      }
    }

    return decrypted;
  }

  /**
   * Hash a value (one-way, for comparison)
   * @param {string} value - Value to hash
   * @returns {string} - Hashed value
   */
  hash(value) {
    if (!value) return null;
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length in bytes
   * @returns {string} - Random token as hex string
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Securely compare two strings (timing-safe)
   * @param {string} a - First string
   * @param {string} b - Second string
   * @returns {boolean} - True if equal
   */
  secureCompare(a, b) {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    
    return crypto.timingSafeEqual(
      Buffer.from(a),
      Buffer.from(b)
    );
  }

  /**
   * Encrypt file contents
   * @param {string} filePath - Path to file
   * @param {string} outputPath - Path for encrypted file
   */
  async encryptFile(filePath, outputPath) {
    const content = await fs.readFile(filePath, 'utf8');
    const encrypted = this.encrypt(content);
    await fs.writeFile(outputPath, JSON.stringify(encrypted), 'utf8');
  }

  /**
   * Decrypt file contents
   * @param {string} filePath - Path to encrypted file
   * @returns {string} - Decrypted content
   */
  async decryptFile(filePath) {
    const encryptedData = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(encryptedData);
    return this.decrypt(parsed);
  }

  /**
   * Rotate encryption key (re-encrypt all data with new key)
   * @param {function} reencryptCallback - Callback to re-encrypt all data
   */
  async rotateKey(reencryptCallback) {
    // Save old key
    const oldKey = this.key;
    
    try {
      // Generate new key
      this.key = crypto.randomBytes(32);
      
      // Call callback to re-encrypt all data
      if (reencryptCallback) {
        await reencryptCallback(this);
      }
      
      // Save new key
      await fs.writeFile(this.keyFile, this.key.toString('hex'), {
        mode: 0o600
      });
      
      console.log('✅ Encryption configuration rotated successfully');
    } catch (error) {
      // Restore old key on error
      this.key = oldKey;
      console.error('Failed to rotate key:', error);
      throw error;
    }
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService;