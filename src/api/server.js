const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
const crypto = require('crypto');

// Security middleware
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const deviceRoutes = require('./routes/devices');
const queueRoutes = require('./routes/queue');
const { router: ipWhitelistRoutes } = require('./routes/ip-whitelist');
const { authenticate } = require('./middleware/auth');
const { enforceFrontendAccess } = require('./middleware/ip-access');
const { errorHandler } = require('./middleware/errorHandler');
const { enforceRBAC, requireWrite, requireConfigure } = require('./middleware/rbac');

class APIServer {
  constructor(config, logger, statsCollector) {
    this.config = config;
    this.logger = logger;
    this.statsCollector = statsCollector;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = null;
    this.redisClient = null;
  }

  async initialize() {
    // SECURITY: Configure Express to properly handle proxied requests
    // Only enable if behind a reverse proxy
    if (process.env.BEHIND_PROXY === 'true') {
      // Trust only specific proxy IPs, never use 'true' for all
      this.app.set('trust proxy', process.env.TRUSTED_PROXIES?.split(',') || ['127.0.0.1']);
    }
    
    // Redis for sessions and caching (optional)
    // Disabled for now - Redis causes retry loop
    this.redisClient = null;
    this.logger.info('Using memory store for sessions (Redis disabled)');

    // Security Headers with Helmet - SECURE CONFIGURATION
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for React
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'none'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        }
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      },
      permissionsPolicy: {
        features: {
          camera: ["'none'"],
          microphone: ["'none'"],
          geolocation: ["'none'"],
          payment: ["'none'"],
          usb: ["'none'"],
          magnetometer: ["'none'"],
          gyroscope: ["'none'"],
          accelerometer: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      originAgentCluster: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      noSniff: true,
      ieNoOpen: true,
      frameguard: { action: 'sameorigin' }
    }));
    
    // Force HTTPS in production
    if (process.env.NODE_ENV === 'production') {
      this.app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
          return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
      });
    }

    // Additional custom security headers and caching
    this.app.use((req, res, next) => {
      // Always set X-Content-Type-Options to prevent MIME sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      
      // Set proper Content-Type based on file extension
      if (req.path.startsWith('/api/')) {
        // No cache for API endpoints
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      } else if (req.path.match(/\.woff2$/)) {
        res.setHeader('Content-Type', 'font/woff2; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (req.path.match(/\.woff$/)) {
        res.setHeader('Content-Type', 'font/woff; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (req.path.match(/\.ttf$/)) {
        res.setHeader('Content-Type', 'font/ttf; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (req.path.match(/\.svg$/)) {
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (req.path.match(/\.(js|css|jpg|jpeg|png|gif|ico|eot)$/)) {
        // Cache static assets for 1 year (they have hash in filename)
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (!req.path.match(/\.[^.]+$/)) {
        // For paths without file extensions (likely routes), serve HTML
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      }
      
      // Don't use Expires header, Cache-Control is preferred
      res.removeHeader('Expires');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Surrogate-Control', 'no-store');
      next();
    });

    // Cookie parser MUST come before other middleware
    this.app.use(cookieParser());
    
    // CORS Configuration - Important: credentials: true for cookies
    this.app.use(cors({
      origin: this.config.api?.cors_origins || ['http://localhost:3000'],
      credentials: true, // CRITICAL for cookies to work cross-origin
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
      exposedHeaders: ['Set-Cookie']
    }));

    // Rate Limiting - Prevent brute force
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // limit each IP to 500 requests per windowMs (increased from 100)
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Stricter rate limit for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20, // 20 login attempts per 15 minutes (increased from 5)
      skipSuccessfulRequests: true,
      message: 'Too many login attempts'
    });

    // Apply rate limiting to ALL routes, not just /api/
    // Skip rate limiting for polling endpoints
    this.app.use((req, res, next) => {
      // Skip rate limiting for admin poll endpoints
      if (req.path === '/api/azure-graph/admin/poll' || 
          req.path === '/api/exchange-config/oauth/poll') {
        return next();
      }
      return limiter(req, res, next);
    });
    this.app.use('/api/auth/login', authLimiter);

    // Session Management with security enhancements
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'default-secret-change-this',
      resave: false,
      saveUninitialized: false,
      rolling: true, // Reset expiry on activity
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS
        maxAge: 1000 * 60 * 60 * 2, // 2 hours (reduced from 24)
        sameSite: 'strict', // CSRF protection
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: '/'
      },
      name: 'smtp.sid', // Change default session name
      genid: () => require('crypto').randomBytes(32).toString('hex'), // Secure session ID
      // Regenerate session on privilege escalation
      unset: 'destroy' // Destroy session on unset
    }));

    // Apply global rate limiting to all routes (already defined above)
    // Note: limiter and authLimiter are already defined at lines 155-169

    // Body Parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // CSRF Protection (for state-changing operations)
    this.app.use((req, res, next) => {
      // Generate CSRF token for session if not exists
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      
      // Skip CSRF for GET requests and auth endpoints
      if (req.method === 'GET' || req.path.startsWith('/api/auth/')) {
        return next();
      }
      
      // Skip CSRF for WebSocket connections
      if (req.path === '/socket.io/') {
        return next();
      }
      
      // Validate CSRF token for state-changing operations
      const token = req.headers['x-csrf-token'] || req.body._csrf;
      console.log(`[CSRF] Checking CSRF for ${req.method} ${req.path}`);
      console.log(`[CSRF] Token from request:`, token ? 'present' : 'missing');
      console.log(`[CSRF] Session token:`, req.session.csrfToken ? 'present' : 'missing');
      
      if (!token || token !== req.session.csrfToken) {
        console.log(`[CSRF] CSRF validation failed!`);
        return res.status(403).json({ 
          error: 'Invalid CSRF token',
          code: 'CSRF_VALIDATION_FAILED'
        });
      }
      
      next();
    });
    
    // Provide CSRF token endpoint
    this.app.get('/api/csrf-token', (req, res) => {
      if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
      }
      res.json({ csrfToken: req.session.csrfToken });
    });

    // Request ID for tracking
    this.app.use((req, res, next) => {
      req.id = require('crypto').randomUUID();
      res.setHeader('X-Request-ID', req.id);
      next();
    });

    // Logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        requestId: req.id
      });
      next();
    });

    // IP Access Control Middleware (after logging, before routes)
    this.app.use(enforceFrontendAccess);

    // Custom static file handler with proper content types
    const serveStaticWithHeaders = (staticPath) => {
      return (req, res, next) => {
        // Set proper content type for SVG files BEFORE serving
        if (req.path.endsWith('.svg')) {
          res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        }
        express.static(staticPath)(req, res, next);
      };
    };

    // Serve static files from dashboard build (if exists)
    const dashboardBuildPath = path.join(__dirname, '../../dashboard/build');
    const dashboardDistPath = path.join(__dirname, '../../dashboard/dist');
    const dashboardPublicPath = path.join(__dirname, '../../dashboard/public');
    
    // Try different possible dashboard locations
    if (require('fs').existsSync(dashboardBuildPath)) {
      this.app.use(serveStaticWithHeaders(dashboardBuildPath));
      this.logger.info(`Serving dashboard from: ${dashboardBuildPath}`);
    } else if (require('fs').existsSync(dashboardDistPath)) {
      this.app.use(serveStaticWithHeaders(dashboardDistPath));
      this.logger.info(`Serving dashboard from: ${dashboardDistPath}`);
    } else if (require('fs').existsSync(dashboardPublicPath)) {
      // For development - serve the raw files
      this.app.use(serveStaticWithHeaders(dashboardPublicPath));
      this.logger.info(`Serving dashboard from: ${dashboardPublicPath}`);
    } else {
      this.logger.warn('Dashboard build not found. Run "npm run build --prefix dashboard" to build it.');
    }

    // API Routes with RBAC
    this.app.use('/api/auth/login', authLimiter); // Apply stricter rate limiting to login
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/dashboard', authenticate, enforceRBAC, dashboardRoutes);
    this.app.use('/api/devices', authenticate, enforceRBAC, deviceRoutes);
    this.app.use('/api/queue', authenticate, enforceRBAC, queueRoutes);
    this.app.use('/api/certificates', authenticate, requireConfigure, require('./routes/certificates'));
    this.app.use('/api/ip-whitelist', authenticate, requireConfigure, ipWhitelistRoutes);
    this.app.use('/api/analytics', authenticate, enforceRBAC, require('./routes/analytics'));
    this.app.use('/api/sessions', require('./routes/sessions'));
    this.app.use('/api/logs', authenticate, enforceRBAC, require('./routes/logs'));
    this.app.use('/api/users', require('./routes/users'));
    this.app.use('/api/mfa', require('./routes/mfa'));
    this.app.use('/api/exchange-config', require('./routes/exchange-config'));
    this.app.use('/api/azure-setup', require('./routes/azure-setup'));
    this.app.use('/api/azure-simple', require('./routes/azure-simple'));
    this.app.use('/api/azure-graph', require('./routes/azure-graph-admin'));
    this.app.use('/api/system', require('./routes/system'));

    // Health Check (no auth required)
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Error Handler
    this.app.use(errorHandler);

    // Catch-all route for client-side routing
    // Must come BEFORE the 404 handler
    this.app.get('*', (req, res, next) => {
      // Skip API routes
      if (req.path.startsWith('/api/')) {
        return next();
      }
      
      // Serve index.html for all non-API routes
      const indexPath = path.join(__dirname, '../../dashboard/dist/index.html');
      if (require('fs').existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        // Fallback to 404 if index.html doesn't exist
        next();
      }
    });

    // 404 Handler for API routes
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        path: req.path
      });
    });

    // Setup WebSocket with authentication
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.io = new Server(this.server, {
      cors: {
        origin: this.config.api?.cors_origins || ['http://localhost:3000'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // WebSocket Authentication Middleware - Updated for cookies
    this.io.use(async (socket, next) => {
      try {
        // Parse cookies from handshake headers
        const cookieHeader = socket.handshake.headers.cookie;
        if (!cookieHeader) {
          return next(new Error('Authentication required'));
        }
        
        // Parse cookies manually (simple parser)
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          cookies[name] = value;
        });
        
        const token = cookies.accessToken;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.role = decoded.role;
        
        this.logger.info(`WebSocket connection from user ${decoded.userId}`);
        next();
      } catch (err) {
        this.logger.warn('WebSocket auth failed:', err.message);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);

      // Join user to their own room for targeted updates
      socket.join(`user:${socket.userId}`);
      
      // Join role-based rooms
      if (socket.role === 'admin') {
        socket.join('admins');
      }

      // Send initial data
      socket.emit('connected', {
        message: 'Connected to SMTP Relay Dashboard',
        userId: socket.userId
      });

      // Handle client requests
      socket.on('request:stats', async () => {
        try {
          const stats = this.statsCollector ? await this.statsCollector.getStats() : {
            totalEmails: 0,
            emailsToday: 0,
            activeDevices: 0,
            queueSize: 0,
            successRate: 95,
            avgProcessingTime: 250
          };
          socket.emit('stats:update', stats);
        } catch (err) {
          console.error('Stats request error:', err);
          // Send default stats instead of empty object
          socket.emit('stats:update', {
            totalEmails: 0,
            emailsToday: 0,
            activeDevices: 0,
            queueSize: 0,
            successRate: 0,
            avgProcessingTime: 0
          });
        }
      });

      socket.on('request:devices', async () => {
        try {
          // Mock device data for now
          const devices = [];
          socket.emit('devices:update', devices);
        } catch (err) {
          console.error('Devices request error:', err);
          socket.emit('devices:update', []);
        }
      });

      // Analytics real-time updates
      socket.on('request:analytics', async (type) => {
        const analyticsRoutes = require('./routes/analytics');
        switch(type) {
          case 'emailFlow':
            socket.emit('analytics:emailFlow', generateMockData.emailFlow());
            break;
          case 'geoDistribution':
            socket.emit('analytics:geoDistribution', generateMockData.geoDistribution());
            break;
          case 'timeSeries':
            socket.emit('analytics:timeSeries', generateMockData.timeSeries());
            break;
          case 'deviceHealth':
            socket.emit('analytics:deviceHealth', generateMockData.deviceHealth());
            break;
        }
      });

      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  // Broadcast updates to all connected clients
  broadcastUpdate(event, data) {
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // Send update to specific user
  sendToUser(userId, event, data) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, data);
    }
  }

  // Send to admin users only
  sendToAdmins(event, data) {
    if (this.io) {
      this.io.to('admins').emit(event, data);
    }
  }

  start(port = 3001) {
    this.server.listen(port, () => {
      this.logger.info(`API Server with WebSocket running on port ${port}`);
      this.logger.info(`Dashboard available at http://localhost:${port}`);
    });
  }

  stop() {
    if (this.io) {
      this.io.close();
    }
    if (this.server) {
      this.server.close();
    }
    if (this.redisClient) {
      this.redisClient.quit();
    }
  }
}

module.exports = APIServer;