// Simplified authentication middleware for development
const authenticate = (req, res, next) => {
  console.log('[AUTH-SIMPLE] Checking authentication for:', req.path);
  console.log('[AUTH-SIMPLE] Cookies:', Object.keys(req.cookies || {}));
  console.log('[AUTH-SIMPLE] Session user:', req.session?.user?.username || 'none');
  console.log('[AUTH-SIMPLE] Has token cookie:', !!req.cookies?.token);
  
  // Check for session-based authentication
  if (req.session && req.session.user) {
    console.log('[AUTH-SIMPLE] ✅ Authenticated via session');
    req.user = req.session.user;
    return next();
  }
  
  // Check for cookie-based token (from login)
  if (req.cookies && req.cookies.token) {
    console.log('[AUTH-SIMPLE] ✅ Authenticated via token cookie');
    // For now, accept any token as valid (simplified for development)
    req.user = {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin'
    };
    return next();
  }
  
  // No authentication found
  console.log('[AUTH-SIMPLE] ❌ No authentication found - returning 401');
  return res.status(401).json({ 
    error: 'Authentication required',
    code: 'NO_AUTH',
    debug: {
      hasCookies: !!req.cookies,
      cookieKeys: Object.keys(req.cookies || {}),
      hasSession: !!req.session,
      sessionUser: !!req.session?.user
    }
  });
};

// Simplified authorization middleware
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'NO_AUTH'
      });
    }
    
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN'
      });
    }
    
    next();
  };
};

module.exports = {
  authenticate,
  authorize
};