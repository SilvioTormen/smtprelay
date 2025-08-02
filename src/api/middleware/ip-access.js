const { ipWhitelistManager } = require('../routes/ip-whitelist');

/**
 * Middleware to enforce IP-based access control for the frontend
 */
const enforceFrontendAccess = (req, res, next) => {
  // Skip for health checks ONLY (auth endpoints need IP check too)
  if (req.path === '/api/health') {
    return next();
  }

  // Get client IP - SECURITY: Only use trusted sources, never client headers
  // In production, configure Express trust proxy settings properly
  const clientIP = req.ip || 
                   req.connection?.remoteAddress || 
                   req.socket?.remoteAddress ||
                   'unknown';

  // Reject if we can't determine IP
  if (clientIP === 'unknown') {
    return res.status(403).json({ 
      error: 'Unable to determine client IP',
      code: 'IP_DETECTION_FAILED'
    });
  }

  // Normalize IPv6 mapped IPv4
  const normalizedIP = clientIP.replace(/^::ffff:/, '');

  // Check if frontend access is allowed
  if (!ipWhitelistManager.isFrontendAllowed(normalizedIP)) {
    // Log denied attempt
    if (ipWhitelistManager.config.settings.log_denied_attempts) {
      console.log(`[IP-ACCESS] Denied frontend access from ${normalizedIP} to ${req.path}`);
      ipWhitelistManager.auditLog('DENIED_ACCESS', 'frontend', 'access', normalizedIP, 'system');
    }

    return res.status(403).json({ 
      error: 'Access denied',
      message: 'Your IP address is not authorized to access this resource'
    });
  }

  // Add IP to request for logging
  req.clientIP = normalizedIP;
  next();
};

/**
 * Middleware to check SMTP relay permissions
 * This is used by the auth handler to determine if auth is required
 */
const checkSMTPAccess = (clientIP) => {
  const normalizedIP = clientIP.replace(/^::ffff:/, '');
  return ipWhitelistManager.isSMTPAllowed(normalizedIP);
};

/**
 * Get IP from request - SECURE VERSION
 * Only uses server-side sources, not client headers
 */
const getClientIP = (req) => {
  // SECURITY: Only use server-determined IP, not client headers
  // Headers like X-Forwarded-For can be spoofed
  const serverIP = req.ip || 
                   req.connection?.remoteAddress || 
                   req.socket?.remoteAddress;

  if (!serverIP || serverIP === 'unknown') {
    return 'unknown';
  }

  // Normalize IPv6 mapped IPv4
  return serverIP.replace(/^::ffff:/, '').trim();
};

module.exports = {
  enforceFrontendAccess,
  checkSMTPAccess,
  getClientIP
};