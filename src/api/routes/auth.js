const express = require('express');
const { body, validationResult } = require('express-validator');
const qrcode = require('qrcode');
const cookieParser = require('cookie-parser');
const {
  authenticate,
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
const userService = require('../services/userService');

const router = express.Router();

// Add cookie parser middleware
router.use(cookieParser());

// Initialize user service
userService.initialize().catch(console.error);

// Keep a reference to the old users map for backward compatibility during migration
const users = new Map();

// Login endpoint with comprehensive security
router.post('/login',
  [
    body('username').trim().isLength({ min: 1, max: 50 }).escape(),
    body('password').isLength({ min: 1, max: 100 }),
    body('totpToken').optional({ nullable: true, checkFalsy: true }).isNumeric().isLength({ min: 6, max: 6 })
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

      // Get user from persistent storage
      const user = await userService.getUser(sanitizedUsername);
      if (!user) {
        // Don't reveal if user exists
        await new Promise(resolve => setTimeout(resolve, 1000)); // Prevent timing attacks
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if account is locked
      if (await userService.isAccountLocked(sanitizedUsername)) {
        const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60000);
        return res.status(423).json({ 
          error: `Account locked. Try again in ${minutesLeft} minutes.`,
          code: 'ACCOUNT_LOCKED'
        });
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.password);
      if (!isValidPassword) {
        // Update failed attempts
        await userService.updateLoginAttempts(sanitizedUsername, true);
        
        return res.status(401).json({ 
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
          remainingAttempts: Math.max(0, 5 - (user.failedAttempts + 1))
        });
      }

      // Check MFA if enabled (TOTP or FIDO2)
      const mfaService = require('../services/mfaService');
      const mfaData = await mfaService.getUserMFA(user.id);
      
      const hasFIDO2 = mfaData?.fido2Enabled && mfaData?.fido2Devices?.length > 0;
      const hasTOTP = user.totpEnabled || mfaData?.totpEnabled;
      
      if (hasTOTP || hasFIDO2) {
        // If no MFA token provided, request it
        if (!totpToken && !req.body.fido2Response) {
          const mfaMethods = [];
          if (hasTOTP) mfaMethods.push('totp');
          if (hasFIDO2) mfaMethods.push('fido2');
          
          return res.status(200).json({
            requiresTwoFactor: true,
            mfaMethods: mfaMethods,
            hasFIDO2: hasFIDO2,
            hasTOTP: hasTOTP,
            message: 'Please provide MFA verification'
          });
        }

        // Verify TOTP if provided
        if (totpToken && hasTOTP) {
          const totpSecret = user.totpSecret || mfaData?.totpSecret;
          const isValid2FA = verify2FAToken(totpSecret, totpToken);
          if (!isValid2FA) {
            return res.status(401).json({ 
              error: 'Invalid 2FA token',
              code: 'INVALID_2FA'
            });
          }
        } 
        // Check if FIDO2 was verified via session
        else if (req.body.fido2Response && hasFIDO2) {
          // Check if FIDO2 was verified in the session
          if (!req.session.mfaVerified || req.session.mfaMethod !== 'fido2' || req.session.mfaUserId !== user.id) {
            return res.status(401).json({ 
              error: 'FIDO2 verification required',
              code: 'FIDO2_NOT_VERIFIED'
            });
          }
          // Clear MFA session after successful verification
          delete req.session.mfaVerified;
          delete req.session.mfaMethod;
          delete req.session.mfaUserId;
          delete req.session.fido2Verified;
        }
      }

      // Reset failed attempts on successful login
      await userService.updateLoginAttempts(sanitizedUsername, false);

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Set BOTH tokens as secure HTTP-only cookies
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes for access token
        path: '/'
      });
      
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth/refresh' // Only sent to refresh endpoint
      });

      // Log successful login
      console.log(`Login successful: ${user.username} from ${clientIp}`);

      // Don't send tokens in response body - only user info
      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions,
          twoFactorEnabled: user.totpEnabled
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
    const user = await userService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Update BOTH token cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });
    
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh'
    });

    res.json({
      success: true,
      message: 'Token refreshed'
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
});

// Get current user info
router.get('/me', authenticate, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Not authenticated',
      code: 'NOT_AUTHENTICATED'
    });
  }
  
  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email || `${req.user.username}@example.com`,
    role: req.user.role,
    permissions: req.user.permissions
  });
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // Blacklist the current token from cookie
    const accessToken = req.cookies.accessToken;
    if (accessToken) {
      blacklistToken(accessToken);
    }

    // Clear ALL auth cookies with same security options as when setting
    res.clearCookie('accessToken', { 
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    res.clearCookie('refreshToken', { 
      path: '/api/auth/refresh',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

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

      const user = await userService.getUser(req.user.username);
      if (!user || !user.totpSecret) {
        return res.status(400).json({ 
          error: '2FA not initialized',
          code: '2FA_NOT_INITIALIZED'
        });
      }

      const isValid = verify2FAToken(user.totpSecret, req.body.token);
      if (isValid) {
        await userService.enableTOTP(user.username, user.totpSecret);
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

// Check current session endpoint
router.get('/session', async (req, res) => {
  try {
    const accessToken = req.cookies.accessToken;
    
    if (!accessToken) {
      return res.status(401).json({ 
        error: 'Not authenticated',
        code: 'NO_SESSION'
      });
    }

    // Verify token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ 
        error: 'Invalid session',
        code: 'INVALID_SESSION'
      });
    }
    
    // Get user
    const user = await userService.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ 
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        twoFactorEnabled: user.totpEnabled
      }
    });
  } catch (error) {
    res.status(401).json({ 
      error: 'Invalid session',
      code: 'INVALID_SESSION'
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

// Export router and users for other modules
module.exports = router;
module.exports.users = users;