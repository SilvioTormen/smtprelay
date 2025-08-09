const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Security Configuration Validator
 * Ensures all security settings are properly configured
 */
class SecurityConfig {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate all security configurations on startup
   */
  validateAll() {
    console.log('🔒 Validating security configuration...');
    
    this.validateSecrets();
    this.validatePasswords();
    this.validateTLS();
    this.validateMFA();
    this.validateEnvironment();
    
    if (this.errors.length > 0) {
      console.error('❌ SECURITY VALIDATION FAILED:');
      // Sanitize error messages to prevent leaking sensitive info
      this.errors.forEach(err => {
        // Remove any potential secrets from error messages
        const sanitized = String(err)
          .replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '[REDACTED]') // Base64 patterns
          .replace(/[0-9a-f]{32,}/gi, '[REDACTED]') // Hex strings (keys/tokens)
          .replace(/(password|secret|token|key|api|jwt)[\s:=]*.{0,50}/gi, '$1=[REDACTED]');
        console.error(`   - ${sanitized}`);
      });
      
      if (process.env.NODE_ENV === 'production') {
        console.error('\n🛑 Cannot start in production with security errors!');
        process.exit(1);
      }
    }
    
    if (this.warnings.length > 0) {
      console.warn('⚠️  Security warnings:');
      this.warnings.forEach(warn => {
        // Sanitize warning messages
        const sanitized = String(warn)
          .replace(/[A-Za-z0-9+/]{20,}={0,2}/g, '[REDACTED]')
          .replace(/[0-9a-f]{32,}/gi, '[REDACTED]')
          .replace(/(password|secret|token|key|api|jwt)[\s:=]*.{0,50}/gi, '$1=[REDACTED]');
        console.warn(`   - ${sanitized}`);
      });
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Security configuration validated successfully');
    }
    
    return this.errors.length === 0;
  }

  /**
   * Validate JWT and session secrets
   */
  validateSecrets() {
    // Auto-generate missing secrets for both dev and production
    // These are critical for security and must exist
    
    // Check JWT_SECRET
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this') || 
        process.env.JWT_SECRET.includes('CHANGE_THIS') || process.env.JWT_SECRET.length < 32) {
      
      // Auto-generate secure secret
      process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
      
      if (process.env.NODE_ENV === 'production') {
        this.warnings.push('JWT_SECRET was auto-generated - save this value for persistent sessions');
        console.log('🔑 Generated JWT_SECRET - Save this in your .env file for persistence');
      } else {
        this.warnings.push('JWT_SECRET auto-generated for development');
      }
    }
    
    // Check JWT_REFRESH_SECRET
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.includes('change-this') || 
        process.env.JWT_REFRESH_SECRET.includes('CHANGE_THIS') || process.env.JWT_REFRESH_SECRET.length < 32) {
      
      process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
      
      if (process.env.NODE_ENV === 'production') {
        this.warnings.push('JWT_REFRESH_SECRET was auto-generated - save this value for persistent sessions');
        console.log('🔑 Generated JWT_REFRESH_SECRET - Save this in your .env file for persistence');
      } else {
        this.warnings.push('JWT_REFRESH_SECRET auto-generated for development');
      }
    }
    
    // Check SESSION_SECRET
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-this') || 
        process.env.SESSION_SECRET.includes('CHANGE_THIS') || process.env.SESSION_SECRET.length < 32) {
      
      process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
      
      if (process.env.NODE_ENV === 'production') {
        this.warnings.push('SESSION_SECRET was auto-generated - save this value for persistent sessions');
        console.log('🔑 Generated SESSION_SECRET - Save this in your .env file for persistence');
      } else {
        this.warnings.push('SESSION_SECRET auto-generated for development');
      }
    }
    
    // Check ENCRYPTION_KEY for data encryption
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
      process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
      
      if (process.env.NODE_ENV === 'production') {
        this.warnings.push('ENCRYPTION_KEY was auto-generated - save this value to decrypt stored data');
        console.log('🔑 Generated ENCRYPTION_KEY - Save this in your .env file for persistence');
      }
    }
    
    // Ensure all secrets are different
    if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET ||
        process.env.JWT_SECRET === process.env.SESSION_SECRET ||
        process.env.JWT_REFRESH_SECRET === process.env.SESSION_SECRET) {
      this.errors.push('Security secrets must be unique (JWT_SECRET, JWT_REFRESH_SECRET, SESSION_SECRET)');
    }
  }

  /**
   * Validate password configurations
   */
  validatePasswords() {
    // Initial passwords are optional - will be set on first login
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_INITIAL_PASSWORD || 
          process.env.ADMIN_INITIAL_PASSWORD.includes('Admin123') ||
          process.env.ADMIN_INITIAL_PASSWORD.includes('CHANGE_THIS')) {
        // Generate secure temporary password if not set
        if (!process.env.ADMIN_INITIAL_PASSWORD) {
          process.env.ADMIN_INITIAL_PASSWORD = SecurityConfig.generatePassword();
          this.warnings.push('Generated temporary admin password - change on first login');
        } else {
          this.warnings.push('Weak ADMIN_INITIAL_PASSWORD detected - must be changed on first login');
        }
      }
      
      if (!process.env.HELPDESK_INITIAL_PASSWORD || 
          process.env.HELPDESK_INITIAL_PASSWORD.includes('Help123') ||
          process.env.HELPDESK_INITIAL_PASSWORD.includes('CHANGE_THIS')) {
        // Generate secure temporary password if not set
        if (!process.env.HELPDESK_INITIAL_PASSWORD) {
          process.env.HELPDESK_INITIAL_PASSWORD = SecurityConfig.generatePassword();
          this.warnings.push('Generated temporary helpdesk password - change on first login');
        } else {
          this.warnings.push('Weak HELPDESK_INITIAL_PASSWORD detected - must be changed on first login');
        }
      }
    }
    
    // Check password policy
    const minLength = parseInt(process.env.PASSWORD_MIN_LENGTH) || 8;
    if (minLength < 8) {
      this.warnings.push('PASSWORD_MIN_LENGTH should be at least 8 characters');
    }
    if (minLength < 12 && process.env.NODE_ENV === 'production') {
      this.warnings.push('Consider using PASSWORD_MIN_LENGTH of 12+ for production');
    }
  }

  /**
   * Validate TLS/HTTPS configuration
   */
  validateTLS() {
    if (process.env.NODE_ENV === 'production') {
      // Check if behind reverse proxy (nginx/Apache with SSL termination)
      const behindProxy = process.env.BEHIND_PROXY === 'true';
      
      if (behindProxy) {
        // When behind proxy, TLS is handled by the proxy
        this.warnings.push('Running behind proxy - ensure proxy handles TLS/HTTPS');
        
        // Check trusted proxies configuration
        if (!process.env.TRUSTED_PROXIES) {
          this.warnings.push('TRUSTED_PROXIES should be configured when BEHIND_PROXY is true');
        }
      } else {
        // Direct exposure - TLS recommended but not required (can be added later via GUI)
        if (process.env.FORCE_HTTPS !== 'true') {
          this.warnings.push('Consider enabling FORCE_HTTPS in production');
        }
        
        // Check TLS certificates - optional, can be configured later
        if (!process.env.TLS_CERT_PATH || !process.env.TLS_KEY_PATH) {
          this.warnings.push('TLS certificates not configured - can be added via admin interface');
        } else {
          // Verify cert files exist if paths are provided
          try {
            if (!fs.existsSync(process.env.TLS_CERT_PATH)) {
              this.warnings.push(`TLS certificate not found: ${process.env.TLS_CERT_PATH}`);
            }
            if (!fs.existsSync(process.env.TLS_KEY_PATH)) {
              this.warnings.push(`TLS key not found: ${process.env.TLS_KEY_PATH}`);
            }
          } catch (err) {
            this.warnings.push('Could not verify TLS certificate files');
          }
        }
      }
      
      // WebAuthn configuration - optional feature
      if (!process.env.RP_ID || process.env.RP_ID === 'localhost') {
        this.warnings.push('WebAuthn/FIDO2 not configured - can be enabled via admin interface');
      }
      if (process.env.RP_ID && process.env.RP_ID !== 'localhost' && 
          (!process.env.ORIGIN || !process.env.ORIGIN.startsWith('https://'))) {
        this.warnings.push('ORIGIN should be https://your-domain when RP_ID is configured');
      }
    }
  }

  /**
   * Validate MFA settings
   */
  validateMFA() {
    if (process.env.NODE_ENV === 'production' && process.env.ENFORCE_MFA !== 'true') {
      this.warnings.push('Consider enabling ENFORCE_MFA for production');
    }
    
    // Check lockout settings
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    if (maxAttempts > 10) {
      this.warnings.push('MAX_LOGIN_ATTEMPTS is high, consider reducing to prevent brute force');
    }
    
    const lockoutDuration = parseInt(process.env.LOCKOUT_DURATION) || 1800000;
    if (lockoutDuration < 600000) { // Less than 10 minutes
      this.warnings.push('LOCKOUT_DURATION is short, consider increasing to 30+ minutes');
    }
  }

  /**
   * Validate general environment settings
   */
  validateEnvironment() {
    // Check NODE_ENV
    if (!process.env.NODE_ENV) {
      this.warnings.push('NODE_ENV not set, defaulting to development');
      process.env.NODE_ENV = 'development';
    }
    
    // Check for development settings in production
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DEBUG === 'true') {
        this.errors.push('DEBUG must be disabled in production');
      }
      
      // Redis is optional - using memory store is fine
      if (process.env.REDIS_HOST && (!process.env.REDIS_PASSWORD || process.env.REDIS_PASSWORD.includes('CHANGE_THIS'))) {
        this.warnings.push('Redis configured but REDIS_PASSWORD not set - consider adding password');
      }
      
      // Database password only required if database is configured
      if (process.env.DB_TYPE && process.env.DB_TYPE !== 'sqlite' && 
          (!process.env.DB_PASSWORD || process.env.DB_PASSWORD.includes('CHANGE_THIS'))) {
        this.warnings.push('Database configured but DB_PASSWORD not set properly');
      }
    }
    
    // Session timeout
    const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 1800000;
    if (sessionTimeout > 86400000) { // More than 24 hours
      this.warnings.push('SESSION_TIMEOUT is very long, consider reducing for security');
    }
  }

  /**
   * Generate secure random secret
   */
  static generateSecret(length = 64) {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Generate secure configuration file
   */
  static generateSecureConfig() {
    const config = {
      JWT_SECRET: SecurityConfig.generateSecret(64),
      JWT_REFRESH_SECRET: SecurityConfig.generateSecret(64),
      SESSION_SECRET: SecurityConfig.generateSecret(64),
      ADMIN_INITIAL_PASSWORD: SecurityConfig.generatePassword(),
      HELPDESK_INITIAL_PASSWORD: SecurityConfig.generatePassword(),
      REDIS_PASSWORD: SecurityConfig.generatePassword(),
      generated_at: new Date().toISOString(),
      warning: 'This file contains secrets. Keep it secure and never commit to version control!'
    };
    
    return config;
  }

  /**
   * Generate strong password
   */
  static generatePassword(length = 16) {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    const all = uppercase + lowercase + numbers + special;
    
    let password = '';
    
    // Ensure at least one of each type
    password += uppercase[crypto.randomInt(uppercase.length)];
    password += lowercase[crypto.randomInt(lowercase.length)];
    password += numbers[crypto.randomInt(numbers.length)];
    password += special[crypto.randomInt(special.length)];
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += all[crypto.randomInt(all.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
  }
}

// Auto-validate on module load
const securityConfig = new SecurityConfig();

// Only validate if not in test environment
if (process.env.NODE_ENV !== 'test') {
  securityConfig.validateAll();
}

module.exports = {
  SecurityConfig,
  securityConfig
};