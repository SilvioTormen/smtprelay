const express = require('express');
const { body, validationResult } = require('express-validator');
const qrcode = require('qrcode');
const {
  generateTokens,
  verifyRefreshToken,
  hashPassword,
  verifyPassword,
  generate2FASecret,
  verify2FAToken,
  blacklistToken,
  validatePasswordStrength,
  sanitizeInput,
  checkUserRateLimit
} = require('../middleware/auth');

const router = express.Router();

// In-memory user store (replace with database in production)
const users = new Map([
  ['admin', {
    id: '1',
    username: 'admin',
    password: null, // Will be set on first run
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'configure'],
    twoFactorSecret: null,
    twoFactorEnabled: false,
    failedAttempts: 0,
    lockedUntil: null
  }],
  ['helpdesk', {
    id: '2',
    username: 'helpdesk',
    password: null,
    role: 'operator',
    permissions: ['read', 'write'],
    twoFactorSecret: null,
    twoFactorEnabled: false,
    failedAttempts: 0,
    lockedUntil: null
  }]
]);

// Initialize default passwords securely
const initializeUsers = async () => {
  const adminUser = users.get('admin');
  const helpdeskUser = users.get('helpdesk');
  
  if (process.env.NODE_ENV === 'production') {
    // Production: Use environment variables
    if (!process.env.ADMIN_INITIAL_PASSWORD || !process.env.HELPDESK_INITIAL_PASSWORD) {
      console.error('❌ ADMIN_INITIAL_PASSWORD and HELPDESK_INITIAL_PASSWORD must be set in production!');
      console.error('Run: node scripts/generate-secrets.js to generate secure configuration');
      process.exit(1);
    }
    
    adminUser.password = await hashPassword(process.env.ADMIN_INITIAL_PASSWORD);
    helpdeskUser.password = await hashPassword(process.env.HELPDESK_INITIAL_PASSWORD);
    
    console.log('✅ Users initialized with secure passwords from environment');
  } else {
    // Development: Generate random passwords
    const crypto = require('crypto');
    const adminPass = 'Dev_' + crypto.randomBytes(8).toString('hex');
    const helpdeskPass = 'Dev_' + crypto.randomBytes(8).toString('hex');
    
    adminUser.password = await hashPassword(adminPass);
    helpdeskUser.password = await hashPassword(helpdeskPass);
    
    console.log('🔐 Development users initialized with random passwords:');
    console.log(`   Admin: admin / ${adminPass}`);
    console.log(`   Helpdesk: helpdesk / ${helpdeskPass}`);
    console.log('   (Save these passwords - they are randomly generated)');
  }
};

initializeUsers();

// Login endpoint with comprehensive security
router.post('/login',
  [
    body('username').trim().isLength({ min: 3, max: 50 }).escape(),
    body('password').isLength({ min: 8, max: 100 }),
    body('totpToken').optional().isNumeric().isLength({ min: 6, max: 6 })
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: errors.array() 
        });
      }

      const { username, password, totpToken } = req.body;
      const sanitizedUsername = sanitizeInput(username);

      // Rate limiting per IP
      const clientIp = req.ip;
      if (!checkUserRateLimit(clientIp, 10, 900000)) { // 10 attempts per 15 minutes
        return res.status(429).json({ 
          error: 'Too many login attempts. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }

      // Get user
      const user = users.get(sanitizedUsername);
      if (!user) {
        // Don't reveal if user exists
        await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent timing attacks
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > Date.now()) {
        const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        return res.status(423).json({ 
          error: `Account locked. Try again in ${minutesLeft} minutes.`,
          code: 'ACCOUNT_LOCKED'
        });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        // Increment failed attempts
        user.failedAttempts++;
        
        // Lock account after 5 failed attempts
        if (user.failedAttempts >= 5) {
          user.lockedUntil = Date.now() + (30 * 60 * 1000); // Lock for 30 minutes
          return res.status(423).json({ 
            error: 'Account locked due to multiple failed attempts',
            code: 'ACCOUNT_LOCKED'
          });
        }

        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
          remainingAttempts: 5 - user.failedAttempts
        });
      }

      // Check 2FA if enabled
      if (user.twoFactorEnabled) {
        if (!totpToken) {
          return res.status(200).json({
            requiresTwoFactor: true,
            message: 'Please provide 2FA token'
          });
        }

        const isValid2FA = verify2FAToken(user.twoFactorSecret, totpToken);
        if (!isValid2FA) {
          return res.status(401).json({ 
            error: 'Invalid 2FA token',
            code: 'INVALID_2FA'
          });
        }
      }

      // Reset failed attempts on successful login
      user.failedAttempts = 0;
      user.lockedUntil = null;

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Set secure HTTP-only cookie for refresh token
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Log successful login
      console.log(`Login successful: ${user.username} from ${clientIp}`);

      res.json({
        success: true,
        accessToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          twoFactorEnabled: user.twoFactorEnabled
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({ 
        error: 'Refresh token required',
        code: 'NO_REFRESH_TOKEN'
      });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return res.status(401).json({ 
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    // Get user
    const user = Array.from(users.values()).find(u => u.id === decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Update refresh token cookie
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      accessToken: tokens.accessToken
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // Blacklist the current token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      blacklistToken(token);
    }

    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

// Enable 2FA
router.post('/2fa/enable',
  require('../middleware/auth').authenticate,
  async (req, res) => {
    try {
      const user = users.get(req.user.username);
      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Generate secret
      const secret = generate2FASecret(user.username);
      user.twoFactorSecret = secret.base32;

      // Generate QR code
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      res.json({
        success: true,
        secret: secret.base32,
        qrCode: qrCodeUrl,
        message: 'Scan QR code with your authenticator app'
      });
    } catch (error) {
      console.error('2FA enable error:', error);
      res.status(500).json({ 
        error: 'Failed to enable 2FA',
        code: '2FA_ENABLE_ERROR'
      });
    }
});

// Verify and confirm 2FA
router.post('/2fa/verify',
  require('../middleware/auth').authenticate,
  [body('token').isNumeric().isLength({ min: 6, max: 6 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Invalid token format',
          details: errors.array() 
        });
      }

      const user = users.get(req.user.username);
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ 
          error: '2FA not initialized',
          code: '2FA_NOT_INITIALIZED'
        });
      }

      const isValid = verify2FAToken(user.twoFactorSecret, req.body.token);
      if (isValid) {
        user.twoFactorEnabled = true;
        res.json({
          success: true,
          message: '2FA enabled successfully'
        });
      } else {
        res.status(400).json({ 
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }
    } catch (error) {
      console.error('2FA verify error:', error);
      res.status(500).json({ 
        error: 'Failed to verify 2FA',
        code: '2FA_VERIFY_ERROR'
      });
    }
});

// Change password
router.post('/change-password',
  require('../middleware/auth').authenticate,
  [
    body('currentPassword').isLength({ min: 8 }),
    body('newPassword').isLength({ min: 8, max: 100 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: 'Invalid input',
          details: errors.array() 
        });
      }

      const { currentPassword, newPassword } = req.body;
      
      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: 'Weak password',
          details: passwordValidation.errors
        });
      }

      const user = users.get(req.user.username);
      if (!user) {
        return res.status(404).json({ 
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Verify current password
      const isValid = await verifyPassword(currentPassword, user.password);
      if (!isValid) {
        return res.status(401).json({ 
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Update password
      user.password = await hashPassword(newPassword);

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ 
        error: 'Failed to change password',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
});

module.exports = router;