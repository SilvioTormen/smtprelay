/**
 * Enhanced Security Headers Middleware
 * Implements comprehensive security headers for production
 */

const helmet = require('helmet');

function getSecurityHeaders(isDevelopment = false) {
  return helmet({
    // Content Security Policy - Strict policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: isDevelopment 
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"] // Development only
          : ["'self'", "'sha256-...'"], // Production: Use hashes for inline scripts
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "wss:", "https:"],
        mediaSrc: ["'none'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", "blob:"],
        childSrc: ["'self'", "blob:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: !isDevelopment ? [] : undefined,
        blockAllMixedContent: !isDevelopment ? [] : undefined,
        reportUri: process.env.CSP_REPORT_URI || null
      }
    },
    
    // Strict Transport Security - 2 years
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true
    },
    
    // Prevent clickjacking
    frameguard: {
      action: 'deny'
    },
    
    // Hide X-Powered-By header
    hidePoweredBy: true,
    
    // Prevent MIME type sniffing
    noSniff: true,
    
    // Prevent IE from opening downloads
    ieNoOpen: true,
    
    // XSS Protection for older browsers
    xssFilter: true,
    
    // Don't cache sensitive data
    noCache: false, // We'll handle caching ourselves
    
    // DNS Prefetch Control
    dnsPrefetchControl: {
      allow: false
    },
    
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    
    // Permissions Policy (formerly Feature Policy)
    permittedCrossDomainPolicies: false,
    
    // Cross-Origin policies
    crossOriginEmbedderPolicy: !isDevelopment,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    
    // Origin Agent Cluster
    originAgentCluster: true
  });
}

/**
 * Additional custom security headers
 */
function customSecurityHeaders(req, res, next) {
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()');
  
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Cache Control for sensitive endpoints
  if (req.path.includes('/api/auth') || req.path.includes('/api/mfa')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add security headers for WebAuthn/FIDO2
  if (req.path.includes('/fido2')) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  next();
}

/**
 * Prevent information disclosure in error responses
 */
function sanitizeErrorResponses(err, req, res, next) {
  // Log the full error internally
  console.error(`Error ${err.status || 500}: ${err.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    user: req.user?.id
  });
  
  // Send sanitized error to client
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    code: err.code || 'ERROR',
    ...(isDevelopment && { stack: err.stack }) // Only in development
  });
}

/**
 * CORS configuration with security
 */
function getSecureCorsOptions() {
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',')
    : ['http://localhost:3000'];
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-MFA-Token'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
}

module.exports = {
  getSecurityHeaders,
  customSecurityHeaders,
  sanitizeErrorResponses,
  getSecureCorsOptions
};