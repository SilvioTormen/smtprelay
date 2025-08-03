// Simplified authentication middleware for development
const authenticate = (req, res, next) => {
  console.log('Auth check - Session:', req.session?.user?.username || 'none');
  
  // Check for session-based authentication
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  
  // Check for cookie-based token (from login)
  if (req.cookies && req.cookies.token) {
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
  return res.status(401).json({ 
    error: 'Authentication required',
    code: 'NO_AUTH'
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