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

// Security middleware
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const deviceRoutes = require('./routes/devices');
const queueRoutes = require('./routes/queue');
const { router: ipWhitelistRoutes } = require('./routes/ip-whitelist');
const { authenticate } = require('./middleware/auth');
const { enforceFrontendAccess } = require('./middleware/ip-access');
const { errorHandler } = require('./middleware/errorHandler');

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
    
    // Redis for sessions and caching
    this.redisClient = createClient({
      host: this.config.redis?.host || 'localhost',
      port: this.config.redis?.port || 6379,
      password: this.config.redis?.password
    });

    this.redisClient.on('error', err => {
      this.logger.error('Redis Client Error:', err);
    });

    await this.redisClient.connect();

    // Security Headers with Helmet - ENHANCED
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          frameAncestors: ["'none'"], // Prevent clickjacking
          formAction: ["'self'"], // Prevent form hijacking
          upgradeInsecureRequests: [] // Force HTTPS
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
      xssFilter: true,
      noSniff: true,
      ieNoOpen: true,
      frameguard: { action: 'deny' }
    }));
    
    // Additional custom security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('Expect-CT', 'enforce, max-age=86400');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
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
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP',
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Stricter rate limit for auth endpoints
    const authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 5, // only 5 login attempts per 15 minutes
      skipSuccessfulRequests: true,
      message: 'Too many login attempts'
    });

    this.app.use('/api/', limiter);
    this.app.use('/api/auth/login', authLimiter);

    // Session Management with security enhancements
    this.app.use(session({
      store: new RedisStore({ client: this.redisClient }),
      secret: process.env.SESSION_SECRET,
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

    // Body Parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/dashboard', authenticate, dashboardRoutes);
    this.app.use('/api/devices', authenticate, deviceRoutes);
    this.app.use('/api/queue', authenticate, queueRoutes);
    this.app.use('/api/certificates', authenticate, require('./routes/certificates'));
    this.app.use('/api/ip-whitelist', authenticate, ipWhitelistRoutes);

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

    // 404 Handler
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
        const stats = await this.statsCollector.getCurrentStats();
        socket.emit('stats:update', stats);
      });

      socket.on('request:devices', async () => {
        const devices = await this.statsCollector.getDeviceList();
        socket.emit('devices:update', devices);
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