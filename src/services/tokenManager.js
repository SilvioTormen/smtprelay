const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');

/**
 * Secure Token Manager for Exchange Online OAuth2
 * Handles multiple accounts with encrypted token storage
 */
class TokenManager {
  constructor(logger) {
    this.logger = logger;
    this.tokenFile = path.join(process.cwd(), 'data', 'exchange-tokens.encrypted');
    this.algorithm = 'aes-256-gcm';
    this.initPromise = this.initialize();
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
      
      // Load or generate encryption key
      await this.loadOrGenerateKey();
      
      // Load existing tokens
      await this.loadTokens();
      
      this.logger?.info('Token manager initialized');
    } catch (error) {
      this.logger?.error('Failed to initialize token manager:', error);
      throw error;
    }
  }

  async loadOrGenerateKey() {
    const keyFile = path.join(process.cwd(), 'data', '.token-key');
    
    try {
      // Try to load existing key
      const keyData = await fs.readFile(keyFile, 'utf8');
      const parsed = JSON.parse(keyData);
      this.encryptionKey = Buffer.from(parsed.key, 'hex');
      this.salt = Buffer.from(parsed.salt, 'hex');
    } catch (error) {
      // Generate new key if not exists
      this.salt = crypto.randomBytes(32);
      // Use a fixed string combined with env variable for consistent key generation
      const keySource = process.env.TOKEN_ENCRYPTION_KEY || 
                       process.env.SESSION_SECRET || 
                       'smtp-relay-token-encryption-2024';
      this.encryptionKey = crypto.pbkdf2Sync(
        keySource,
        this.salt,
        100000,
        32,
        'sha256'
      );
      
      // Save key with restricted permissions
      await fs.writeFile(
        keyFile,
        JSON.stringify({
          key: this.encryptionKey.toString('hex'),
          salt: this.salt.toString('hex')
        }),
        { mode: 0o600 }
      );
    }
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async loadTokens() {
    try {
      const encryptedData = await fs.readFile(this.tokenFile, 'utf8');
      const parsed = JSON.parse(encryptedData);
      const decrypted = this.decrypt(parsed);
      this.tokens = JSON.parse(decrypted);
    } catch (error) {
      // Initialize empty if file doesn't exist
      this.tokens = {
        accounts: [],
        default: null
      };
    }
  }

  async saveTokens() {
    const data = JSON.stringify(this.tokens);
    const encrypted = this.encrypt(data);
    
    await fs.writeFile(
      this.tokenFile,
      JSON.stringify(encrypted, null, 2),
      { mode: 0o600 }
    );
  }

  /**
   * Add or update tokens for an account
   */
  async saveAccountTokens(accountData) {
    await this.initPromise;
    
    const {
      tenantId,
      clientId,
      email,
      displayName,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      tokenType = 'Bearer'
    } = accountData;

    // Create account identifier
    const accountId = `${tenantId}_${clientId}`;
    
    // Find or create account entry
    let account = this.tokens.accounts.find(a => a.id === accountId);
    
    if (!account) {
      account = {
        id: accountId,
        tenantId,
        clientId,
        email,
        displayName,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        tokens: []
      };
      this.tokens.accounts.push(account);
    }

    // Update account info
    account.email = email || account.email;
    account.displayName = displayName || account.displayName;
    account.lastUpdated = new Date().toISOString();

    // Add new token entry (keep history)
    account.tokens.unshift({
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      tokenType,
      acquiredAt: new Date().toISOString(),
      isActive: true
    });

    // Keep only last 5 token sets for history
    account.tokens = account.tokens.slice(0, 5);
    
    // Mark older tokens as inactive
    account.tokens.forEach((token, index) => {
      if (index > 0) token.isActive = false;
    });

    // Set as default if it's the first account
    if (this.tokens.accounts.length === 1) {
      this.tokens.default = accountId;
    }

    await this.saveTokens();
    
    this.logger?.info(`Tokens saved for account: ${email || accountId}`);
    
    return accountId;
  }

  /**
   * Get active tokens for an account
   */
  async getAccountTokens(accountId) {
    await this.initPromise;
    
    const account = this.tokens.accounts.find(a => a.id === accountId);
    if (!account) return null;
    
    const activeToken = account.tokens.find(t => t.isActive);
    if (!activeToken) return null;
    
    // Check if token is expired
    if (activeToken.expiresAt && new Date(activeToken.expiresAt) < new Date()) {
      // Try to refresh if we have a refresh token
      if (activeToken.refreshToken) {
        return {
          ...activeToken,
          needsRefresh: true,
          account: {
            id: account.id,
            tenantId: account.tenantId,
            clientId: account.clientId,
            email: account.email,
            displayName: account.displayName
          }
        };
      }
      return null;
    }
    
    // Update last used
    account.lastUsed = new Date().toISOString();
    await this.saveTokens();
    
    return {
      ...activeToken,
      account: {
        id: account.id,
        tenantId: account.tenantId,
        clientId: account.clientId,
        email: account.email,
        displayName: account.displayName
      }
    };
  }

  /**
   * Get default account tokens
   */
  async getDefaultTokens() {
    await this.initPromise;
    
    if (!this.tokens.default) {
      // Try to use first account if no default set
      if (this.tokens.accounts.length > 0) {
        this.tokens.default = this.tokens.accounts[0].id;
        await this.saveTokens();
      } else {
        return null;
      }
    }
    
    return this.getAccountTokens(this.tokens.default);
  }

  /**
   * List all accounts
   */
  async listAccounts() {
    await this.initPromise;
    
    return this.tokens.accounts.map(account => {
      const activeToken = account.tokens.find(t => t.isActive);
      const isExpired = activeToken?.expiresAt ? 
        new Date(activeToken.expiresAt) < new Date() : true;
      
      return {
        id: account.id,
        tenantId: account.tenantId,
        clientId: account.clientId,
        email: account.email,
        displayName: account.displayName,
        isDefault: this.tokens.default === account.id,
        createdAt: account.createdAt,
        lastUsed: account.lastUsed,
        lastUpdated: account.lastUpdated,
        hasValidToken: !!activeToken && !isExpired,
        tokenExpiresAt: activeToken?.expiresAt,
        tokenAcquiredAt: activeToken?.acquiredAt,
        tokenRefreshedFrom: activeToken?.refreshedFrom,
        tokenCount: account.tokens.length,
        hasRefreshToken: !!activeToken?.refreshToken
      };
    });
  }

  /**
   * Set default account
   */
  async setDefaultAccount(accountId) {
    await this.initPromise;
    
    const account = this.tokens.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    
    this.tokens.default = accountId;
    await this.saveTokens();
    
    this.logger?.info(`Default account set to: ${account.email || accountId}`);
  }

  /**
   * Remove an account
   */
  async removeAccount(accountId) {
    await this.initPromise;
    
    const index = this.tokens.accounts.findIndex(a => a.id === accountId);
    if (index === -1) {
      throw new Error('Account not found');
    }
    
    const removed = this.tokens.accounts.splice(index, 1)[0];
    
    // Update default if necessary
    if (this.tokens.default === accountId) {
      this.tokens.default = this.tokens.accounts.length > 0 ? 
        this.tokens.accounts[0].id : null;
    }
    
    await this.saveTokens();
    
    this.logger?.info(`Account removed: ${removed.email || accountId}`);
  }

  /**
   * Refresh tokens for an account
   */
  async refreshAccountTokens(accountId, newTokens) {
    await this.initPromise;
    
    const account = this.tokens.accounts.find(a => a.id === accountId);
    if (!account) {
      throw new Error('Account not found');
    }
    
    // Add refreshed tokens
    account.tokens.unshift({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken || account.tokens[0]?.refreshToken,
      expiresAt: newTokens.expiresAt,
      scope: newTokens.scope || account.tokens[0]?.scope,
      tokenType: newTokens.tokenType || 'Bearer',
      acquiredAt: new Date().toISOString(),
      isActive: true,
      refreshedFrom: account.tokens[0]?.acquiredAt
    });
    
    // Keep history
    account.tokens = account.tokens.slice(0, 5);
    account.tokens.forEach((token, index) => {
      if (index > 0) token.isActive = false;
    });
    
    account.lastUpdated = new Date().toISOString();
    
    await this.saveTokens();
    
    this.logger?.info(`Tokens refreshed for account: ${account.email || accountId}`);
  }

  /**
   * Get token statistics
   */
  async getStatistics() {
    await this.initPromise;
    
    const stats = {
      totalAccounts: this.tokens.accounts.length,
      activeAccounts: 0,
      expiredAccounts: 0,
      totalTokens: 0,
      oldestToken: null,
      newestToken: null
    };
    
    for (const account of this.tokens.accounts) {
      stats.totalTokens += account.tokens.length;
      
      const activeToken = account.tokens.find(t => t.isActive);
      if (activeToken) {
        const isExpired = activeToken.expiresAt ? 
          new Date(activeToken.expiresAt) < new Date() : true;
        
        if (isExpired) {
          stats.expiredAccounts++;
        } else {
          stats.activeAccounts++;
        }
        
        // Track oldest and newest
        if (!stats.oldestToken || activeToken.acquiredAt < stats.oldestToken) {
          stats.oldestToken = activeToken.acquiredAt;
        }
        if (!stats.newestToken || activeToken.acquiredAt > stats.newestToken) {
          stats.newestToken = activeToken.acquiredAt;
        }
      }
    }
    
    return stats;
  }
}

// Singleton instance
let instance = null;

module.exports = {
  getInstance: (logger) => {
    if (!instance) {
      instance = new TokenManager(logger);
    }
    return instance;
  },
  TokenManager
};