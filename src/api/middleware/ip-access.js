const ipRangeCheck = require('ip-range-check');

// Default allowed IPs (localhost and private networks)
const defaultAllowedIPs = [
  '127.0.0.1',
  '::1',
  '192.168.0.0/16',
  '10.0.0.0/8',
  '172.16.0.0/12'
];

const enforceFrontendAccess = (req, res, next) => {
  // Skip IP check for health endpoint
  if (req.path === '/api/health') {
    return next();
  }

  // Get client IP
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  
  // Extract IPv4 from IPv6 format if needed
  const cleanIP = clientIP.includes('::ffff:') ? 
    clientIP.replace('::ffff:', '') : 
    clientIP;

  // Check if IP is allowed
  const allowedIPs = process.env.FRONTEND_ALLOWED_IPS ? 
    process.env.FRONTEND_ALLOWED_IPS.split(',') : 
    defaultAllowedIPs;

  const isAllowed = ipRangeCheck(cleanIP, allowedIPs);

  if (!isAllowed) {
    console.log(`Access denied for IP: ${cleanIP}`);
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address is not authorized to access this resource'
    });
  }

  next();
};

const checkIPWhitelist = (allowedIPs) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    const cleanIP = clientIP.includes('::ffff:') ? 
      clientIP.replace('::ffff:', '') : 
      clientIP;

    if (ipRangeCheck(cleanIP, allowedIPs)) {
      next();
    } else {
      res.status(403).json({
        error: 'Access denied',
        ip: cleanIP
      });
    }
  };
};

module.exports = {
  enforceFrontendAccess,
  checkIPWhitelist
};