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
      this.errors.forEach(err => console.error(`   - ${err}`));
      
      if (process.env.NODE_ENV === 'production') {
        console.error('\n🛑 Cannot start in production with security errors!');
        process.exit(1);
      }
    }
    
    if (this.warnings.length > 0) {
      console.warn('⚠️  Security warnings:');
      this.warnings.forEach(warn => console.warn(`   - ${warn}`));
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
    // Check JWT_SECRET
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('change-this') || 
        process.env.JWT_SECRET.includes('CHANGE_THIS') || process.env.JWT_SECRET.length < 32) {
      
      if (process.env.NODE_ENV === 'production') {
        this.errors.push('JWT_SECRET is not properly configured or too weak');
      } else {
        // Auto-generate secure secret for development
        process.env.JWT_SECRET = crypto.randomBytes(64).toString('base64');
        this.warnings.push('JWT_SECRET auto-generated for development');
      }
    }
    
    // Check JWT_REFRESH_SECRET
    if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.includes('change-this') || 
        process.env.JWT_REFRESH_SECRET.includes('CHANGE_THIS') || process.env.JWT_REFRESH_SECRET.length < 32) {
      
      if (process.env.NODE_ENV === 'production') {
        this.errors.push('JWT_REFRESH_SECRET is not properly configured or too weak');
      } else {
        process.env.JWT_REFRESH_SECRET = crypto.randomBytes(64).toString('base64');
        this.warnings.push('JWT_REFRESH_SECRET auto-generated for development');
      }
    }
    
    // Check SESSION_SECRET
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes('change-this') || 
        process.env.SESSION_SECRET.includes('CHANGE_THIS') || process.env.SESSION_SECRET.length < 32) {
      
      if (process.env.NODE_ENV === 'production') {
        this.errors.push('SESSION_SECRET is not properly configured or too weak');
      } else {
        process.env.SESSION_SECRET = crypto.randomBytes(64).toString('base64');
        this.warnings.push('SESSION_SECRET auto-generated for development');
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
    // Check initial admin passwords
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.ADMIN_INITIAL_PASSWORD || 
          process.env.ADMIN_INITIAL_PASSWORD.includes('Admin123') ||
          process.env.ADMIN_INITIAL_PASSWORD.includes('CHANGE_THIS')) {
        this.errors.push('ADMIN_INITIAL_PASSWORD must be set to a strong password in production');
      }
      
      if (!process.env.HELPDESK_INITIAL_PASSWORD || 
          process.env.HELPDESK_INITIAL_PASSWORD.includes('Help123') ||
          process.env.HELPDESK_INITIAL_PASSWORD.includes('CHANGE_THIS')) {
        this.errors.push('HELPDESK_INITIAL_PASSWORD must be set to a strong password in production');
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
      // Check HTTPS enforcement
      if (process.env.FORCE_HTTPS !== 'true') {
        this.errors.push('FORCE_HTTPS must be enabled in production');
      }
      
      // Check TLS certificates
      if (!process.env.TLS_CERT_PATH || !process.env.TLS_KEY_PATH) {
        this.errors.push('TLS_CERT_PATH and TLS_KEY_PATH must be configured for production');
      } else {
        // Verify cert files exist
        try {
          if (!fs.existsSync(process.env.TLS_CERT_PATH)) {
            this.errors.push(`TLS certificate not found: ${process.env.TLS_CERT_PATH}`);
          }
          if (!fs.existsSync(process.env.TLS_KEY_PATH)) {
            this.errors.push(`TLS key not found: ${process.env.TLS_KEY_PATH}`);
          }
        } catch (err) {
          this.warnings.push('Could not verify TLS certificate files');
        }
      }
      
      // Check WebAuthn configuration
      if (!process.env.RP_ID || process.env.RP_ID === 'localhost') {
        this.errors.push('RP_ID must be set to your domain for WebAuthn/FIDO2');
      }
      if (!process.env.ORIGIN || !process.env.ORIGIN.startsWith('https://')) {
        this.errors.push('ORIGIN must be set to https://your-domain for WebAuthn/FIDO2');
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
      
      // Check Redis password
      if (!process.env.REDIS_PASSWORD || process.env.REDIS_PASSWORD.includes('CHANGE_THIS')) {
        this.errors.push('REDIS_PASSWORD must be set in production');
      }
      
      // Check database password if using database
      if (process.env.DB_TYPE && (!process.env.DB_PASSWORD || process.env.DB_PASSWORD.includes('CHANGE_THIS'))) {
        this.errors.push('DB_PASSWORD must be set in production');
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