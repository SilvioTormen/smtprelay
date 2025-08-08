const crypto = require('crypto');

// CSRF Token storage (use Redis in production)
const csrfTokens = new Map();
const TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

// Clean expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of csrfTokens.entries()) {
    if (now - data.created > TOKEN_EXPIRY) {
      csrfTokens.delete(token);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes

/**
 * Generate CSRF token for user session
 */
const generateCSRFToken = (req, res, next) => {
  if (!req.session) {
    return res.status(500).json({ error: 'Session not initialized' });
  }
  
  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store with session binding
  csrfTokens.set(token, {
    sessionId: req.sessionID,
    userId: req.user?.id,
    created: Date.now()
  });
  
  // Also store in session for double-submit cookie pattern
  req.session.csrfToken = token;
  
  // Set as response header
  res.setHeader('X-CSRF-Token', token);
  
  // Add to response locals for templates
  res.locals.csrfToken = token;
  
  next();
};

/**
 * Verify CSRF token on state-changing operations
 */
const verifyCSRFToken = (req, res, next) => {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip for API calls with valid JWT (they have their own CSRF protection)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }
  
  // Get token from multiple sources
  const token = req.headers['x-csrf-token'] || 
                req.body?._csrf || 
                req.query?._csrf;
  
  if (!token) {
    return res.status(403).json({ 
      error: 'CSRF token missing',
      code: 'CSRF_TOKEN_MISSING'
    });
  }
  
  // First check if token matches session token
  const sessionToken = req.session?.csrfToken || req.session?._csrf;
  if (sessionToken && token === sessionToken) {
    // Token matches session - valid
    return next();
  }
  
  // Otherwise check token map
  const tokenData = csrfTokens.get(token);
  
  if (!tokenData) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      code: 'CSRF_TOKEN_INVALID'
    });
  }
  
  // Verify session binding
  if (tokenData.sessionId !== req.sessionID) {
    return res.status(403).json({ 
      error: 'CSRF token mismatch',
      code: 'CSRF_TOKEN_MISMATCH'
    });
  }
  
  // Verify user binding if authenticated
  if (req.user && tokenData.userId !== req.user.id) {
    return res.status(403).json({ 
      error: 'CSRF token user mismatch',
      code: 'CSRF_TOKEN_USER_MISMATCH'
    });
  }
  
  // Check token age
  if (Date.now() - tokenData.created > TOKEN_EXPIRY) {
    csrfTokens.delete(token);
    return res.status(403).json({ 
      error: 'CSRF token expired',
      code: 'CSRF_TOKEN_EXPIRED'
    });
  }
  
  // Token is valid
  next();
};

/**
 * Get CSRF token endpoint
 */
const getCSRFToken = (req, res) => {
  // Generate new token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Store with session binding
  csrfTokens.set(token, {
    sessionId: req.sessionID,
    userId: req.user?.id,
    created: Date.now()
  });
  
  // Store in session
  req.session.csrfToken = token;
  
  res.json({ 
    csrfToken: token,
    expiresIn: TOKEN_EXPIRY
  });
};

/**
 * Double-submit cookie pattern for additional security
 */
const doubleSubmitCookie = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  const cookieToken = req.cookies?.['csrf-token'];
  const headerToken = req.headers['x-csrf-token'];
  
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ 
      error: 'CSRF protection failed',
      code: 'CSRF_DOUBLE_SUBMIT_FAILED'
    });
  }
  
  // Use constant-time comparison
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return res.status(403).json({ 
      error: 'CSRF token mismatch',
      code: 'CSRF_DOUBLE_SUBMIT_MISMATCH'
    });
  }
  
  next();
};

module.exports = {
  generateCSRFToken,
  verifyCSRFToken,
  getCSRFToken,
  doubleSubmitCookie
};