const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { hashPassword } = require('../middleware/auth');
const encryptionService = require('./encryptionService');

class UserService {
  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.users = new Map();
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize encryption service first
      await encryptionService.initialize();
      
      // Create data directory if it doesn't exist
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Check if users file exists
      try {
        const data = await fs.readFile(this.usersFile, 'utf8');
        const usersData = JSON.parse(data);
        
        // Load and decrypt existing users
        for (const [username, userData] of Object.entries(usersData)) {
          // Decrypt sensitive fields
          if (userData.totpSecret && typeof userData.totpSecret === 'object') {
            userData.totpSecret = encryptionService.decrypt(userData.totpSecret);
          }
          this.users.set(username, userData);
        }
        
        console.log(`✅ Loaded ${this.users.size} users from encrypted persistent storage`);
      } catch (error) {
        // File doesn't exist or is invalid, initialize with default users
        await this.initializeDefaultUsers();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize UserService:', error);
      throw error;
    }
  }

  async initializeDefaultUsers() {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    // Default users with roles and permissions
    const defaultUsers = [
      {
        username: 'admin',
        role: 'admin',
        permissions: ['read', 'write', 'delete', 'configure', 'manage_users'],
        displayName: 'Administrator'
      },
      {
        username: 'helpdesk',
        role: 'viewer',
        permissions: ['read'],
        displayName: 'Helpdesk User'
      },
      {
        username: 'engineering',
        role: 'operator',
        permissions: ['read', 'write', 'configure'],
        displayName: 'Engineering User'
      }
    ];

    console.log('🔐 Initializing default users...');
    
    for (const userTemplate of defaultUsers) {
      // Generate random password
      const password = isDevelopment
        ? `Dev_${crypto.randomBytes(8).toString('hex')}`
        : crypto.randomBytes(15).toString('base64').replace(/[+/=]/g, '');
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create user object
      const user = {
        id: String(this.users.size + 1),
        username: userTemplate.username,
        password: hashedPassword,
        role: userTemplate.role,
        permissions: userTemplate.permissions,
        displayName: userTemplate.displayName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        failedAttempts: 0,
        lockedUntil: null,
        totpSecret: null,
        totpEnabled: false,
        mfaEnforced: false,
        lastLogin: null,
        passwordChangedAt: new Date().toISOString(),
        requirePasswordChange: false
      };
      
      this.users.set(userTemplate.username, user);
      
      // Log credentials for development
      if (isDevelopment) {
        const roleLabel = userTemplate.role === 'admin' ? 'Admin' :
                         userTemplate.role === 'viewer' ? 'Helpdesk (viewer)' :
                         'Engineering (operator)';
        console.log(`   ${roleLabel}: ${userTemplate.username} / ${password}`);
      }
    }
    
    if (isDevelopment) {
      console.log('   📝 Save these passwords - they are randomly generated on each restart!');
    }
    
    // Save to file
    await this.saveUsers();
  }

  async saveUsers() {
    try {
      const usersData = {};
      
      for (const [username, userData] of this.users.entries()) {
        const encrypted = { ...userData };
        
        // Encrypt sensitive fields
        if (userData.totpSecret) {
          encrypted.totpSecret = encryptionService.encrypt(userData.totpSecret);
        }
        
        // Note: passwords are already hashed, no need to encrypt
        // Other sensitive data can be encrypted here if needed
        
        usersData[username] = encrypted;
      }
      
      await fs.writeFile(
        this.usersFile,
        JSON.stringify(usersData, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save users:', error);
      throw error;
    }
  }

  async getUser(username) {
    await this.initialize();
    return this.users.get(username);
  }

  async getUserById(userId) {
    await this.initialize();
    for (const user of this.users.values()) {
      if (user.id === String(userId)) {
        return user;
      }
    }
    return null;
  }

  async updateUser(username, updates) {
    await this.initialize();
    const user = this.users.get(username);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Update user data
    Object.assign(user, updates, {
      updatedAt: new Date().toISOString()
    });
    
    // Save changes
    await this.saveUsers();
    
    return user;
  }

  async updateUserById(userId, updates) {
    await this.initialize();
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    return this.updateUser(user.username, updates);
  }

  async createUser(userData) {
    await this.initialize();
    
    if (this.users.has(userData.username)) {
      throw new Error('Username already exists');
    }
    
    // Hash password if provided
    if (userData.password) {
      userData.password = await hashPassword(userData.password);
    }
    
    const user = {
      id: String(this.users.size + 1),
      ...userData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failedAttempts: 0,
      lockedUntil: null,
      totpSecret: null,
      totpEnabled: false,
      mfaEnforced: false,
      lastLogin: null,
      passwordChangedAt: new Date().toISOString(),
      requirePasswordChange: false
    };
    
    this.users.set(userData.username, user);
    await this.saveUsers();
    
    return user;
  }

  async deleteUser(username) {
    await this.initialize();
    
    if (!this.users.has(username)) {
      throw new Error('User not found');
    }
    
    // Don't allow deleting the last admin
    const user = this.users.get(username);
    if (user.role === 'admin') {
      const adminCount = Array.from(this.users.values())
        .filter(u => u.role === 'admin').length;
      
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last admin user');
      }
    }
    
    this.users.delete(username);
    await this.saveUsers();
    
    return true;
  }

  async getAllUsers() {
    await this.initialize();
    return Array.from(this.users.values());
  }

  async updatePassword(username, newPassword) {
    await this.initialize();
    
    const hashedPassword = await hashPassword(newPassword);
    
    return this.updateUser(username, {
      password: hashedPassword,
      passwordChangedAt: new Date().toISOString(),
      requirePasswordChange: false
    });
  }

  async updateLoginAttempts(username, failed = false) {
    await this.initialize();
    const user = this.users.get(username);
    if (!user) return;
    
    if (failed) {
      user.failedAttempts++;
      
      // Lock account after 5 failed attempts
      if (user.failedAttempts >= 5) {
        user.lockedUntil = Date.now() + (15 * 60 * 1000); // 15 minutes
      }
    } else {
      // Reset on successful login
      user.failedAttempts = 0;
      user.lockedUntil = null;
      user.lastLogin = new Date().toISOString();
    }
    
    await this.saveUsers();
  }

  async isAccountLocked(username) {
    await this.initialize();
    const user = this.users.get(username);
    if (!user) return false;
    
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return true;
    }
    
    // Clear expired lock
    if (user.lockedUntil && user.lockedUntil <= Date.now()) {
      user.lockedUntil = null;
      user.failedAttempts = 0;
      await this.saveUsers();
    }
    
    return false;
  }

  async enableTOTP(username, secret) {
    return this.updateUser(username, {
      totpSecret: secret,
      totpEnabled: true
    });
  }

  async disableTOTP(username) {
    return this.updateUser(username, {
      totpSecret: null,
      totpEnabled: false
    });
  }

  async enforceMFA(username, enforce = true) {
    return this.updateUser(username, {
      mfaEnforced: enforce
    });
  }
}

// Create singleton instance
const userService = new UserService();

module.exports = userService;