const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const speakeasy = require('speakeasy');

// Load security configuration validator
require('../../config/security');

// JWT Secrets - validated by security config
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  console.error('❌ JWT secrets not configured properly!');
  process.exit(1);
}

// Token expiry times
const ACCESS_TOKEN_EXPIRY = '15m'; // Short-lived access token
const REFRESH_TOKEN_EXPIRY = '7d'; // Longer refresh token

// Security: Authenticate middleware - Now supports cookies
const authenticate = async (req, res, next) => {
  try {
    let token;
    
    // First, check for token in cookie (preferred)
    if (req.cookies && (req.cookies.accessToken || req.cookies.token)) {
      token = req.cookies.accessToken || req.cookies.token;
    } 
    // Fallback to Authorization header for backward compatibility (will be removed)
    else {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'NO_TOKEN'
        });
      }
      token = authHeader.substring(7);
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token is blacklisted (logout tokens)
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({ 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Add user info to request (support both formats)
    req.user = {
      id: decoded.userId || decoded.id,
      username: decoded.username,
      role: decoded.role,
      permissions: decoded.permissions || []
    };

    // Log access for audit
    logAccess(req.user, req.path, req.method);

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({ 
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
};

// Role-based access control
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logUnauthorizedAccess(req.user, req.path);
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
};

// Permission-based access control
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!req.user.permissions.includes(permission)) {
      logUnauthorizedAccess(req.user, req.path, permission);
      return res.status(403).json({ 
        error: 'Missing required permission',
        code: 'PERMISSION_DENIED',
        required: permission
      });
    }

    next();
  };
};

// Generate tokens
const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions || []
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'smtp-relay',
    audience: 'smtp-relay-dashboard'
  });

  const refreshToken = jwt.sign(
    { userId: user.id },
    JWT_REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: 'smtp-relay'
    }
  );

  return { accessToken, refreshToken };
};

// Verify refresh token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
};

// Hash password securely
const hashPassword = async (password) => {
  const saltRounds = 12; // High cost factor for security
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// 2FA Support
const generate2FASecret = (username) => {
  const secret = speakeasy.generateSecret({
    name: `SMTP Relay (${username})`,
    length: 32
  });
  return secret;
};

const verify2FAToken = (secret, token) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2 time windows for clock skew
  });
};

// CSRF Token generation
const generateCSRFToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

const verifyCSRFToken = (sessionToken, requestToken) => {
  return sessionToken === requestToken;
};

// Rate limiting per user
const userRateLimiter = new Map();

const checkUserRateLimit = (userId, limit = 100, window = 60000) => {
  const now = Date.now();
  const userLimits = userRateLimiter.get(userId) || { count: 0, resetTime: now + window };

  if (now > userLimits.resetTime) {
    userLimits.count = 1;
    userLimits.resetTime = now + window;
  } else {
    userLimits.count++;
  }

  userRateLimiter.set(userId, userLimits);

  return userLimits.count <= limit;
};

// Token blacklist (for logout)
const tokenBlacklist = new Set();

const blacklistToken = (token) => {
  tokenBlacklist.add(token);
  // Clean up expired tokens periodically
  setTimeout(() => tokenBlacklist.delete(token), 24 * 60 * 60 * 1000);
};

const isTokenBlacklisted = async (token) => {
  return tokenBlacklist.has(token);
};

// Audit logging
const logAccess = (user, path, method) => {
  const log = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    role: user.role,
    path,
    method,
    type: 'ACCESS'
  };
  
  // This would write to audit log
  console.log('AUDIT:', JSON.stringify(log));
};

const logUnauthorizedAccess = (user, path, permission = null) => {
  const log = {
    timestamp: new Date().toISOString(),
    userId: user.id,
    username: user.username,
    role: user.role,
    path,
    permission,
    type: 'UNAUTHORIZED_ACCESS'
  };
  
  console.error('SECURITY:', JSON.stringify(log));
};

// Password strength validation
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Input sanitization
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove any potential XSS attempts
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  generateTokens,
  verifyRefreshToken,
  hashPassword,
  verifyPassword,
  generate2FASecret,
  verify2FAToken,
  generateCSRFToken,
  verifyCSRFToken,
  checkUserRateLimit,
  blacklistToken,
  validatePasswordStrength,
  sanitizeInput
};