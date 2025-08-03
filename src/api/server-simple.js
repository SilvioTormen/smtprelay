const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// Import routes
const authRoutes = require('./routes/auth-simple'); // Use simplified auth
const dashboardRoutes = require('./routes/dashboard');
const deviceRoutes = require('./routes/devices');
const queueRoutes = require('./routes/queue');
const certificatesRoutes = require('./routes/certificates');
const analyticsRoutes = require('./routes/analytics');
const sessionsRoutes = require('./routes/sessions');
const ipWhitelistRoutes = require('./routes/ip-whitelist');
const logsRoutes = require('./routes/logs');

class SimpleAPIServer {
  constructor(config, logger, statsCollector) {
    this.config = config;
    this.logger = logger;
    this.statsCollector = statsCollector;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = null;
  }

  async initialize() {
    // Basic middleware
    this.app.use(helmet({
      contentSecurityPolicy: false // Disable for simplicity
    }));
    
    this.app.use(cors({
      origin: true,
      credentials: true
    }));
    
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(cookieParser());

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100
    });
    this.app.use('/api/', limiter);

    // Simple session without Redis
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'change-this-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
      }
    }));

    // Serve static files from dashboard
    const dashboardPath = path.join(__dirname, '../../dashboard/dist');
    if (fs.existsSync(dashboardPath)) {
      this.app.use(express.static(dashboardPath));
      this.logger.info(`Serving dashboard from: ${dashboardPath}`);
    }

    // Import proper auth middleware
    const { authenticate } = require('./middleware/auth-simple');

    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/dashboard', authenticate, dashboardRoutes);
    this.app.use('/api/devices', authenticate, deviceRoutes);
    this.app.use('/api/queue', authenticate, queueRoutes);
    this.app.use('/api/logs', authenticate, logsRoutes);
    
    // Optional routes - check if they exist
    try {
      this.app.use('/api/certificates', authenticate, certificatesRoutes);
    } catch (e) {
      this.logger.warn('Certificates route not available');
    }
    
    try {
      this.app.use('/api/analytics', authenticate, analyticsRoutes);
    } catch (e) {
      this.logger.warn('Analytics route not available');
    }
    
    try {
      this.app.use('/api/sessions', sessionsRoutes);
    } catch (e) {
      this.logger.warn('Sessions route not available');
    }
    
    try {
      if (ipWhitelistRoutes.router) {
        this.app.use('/api/ip-whitelist', authenticate, ipWhitelistRoutes.router);
      } else {
        this.app.use('/api/ip-whitelist', authenticate, ipWhitelistRoutes);
      }
    } catch (e) {
      this.logger.warn('IP Whitelist route not available');
    }

    // Health endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Catch-all for dashboard routes
    this.app.get('*', (req, res) => {
      const indexPath = path.join(__dirname, '../../dashboard/dist/index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Dashboard not found' });
      }
    });

    // Setup WebSocket
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.io = new Server(this.server, {
      cors: {
        origin: true,
        credentials: true
      }
    });

    this.io.on('connection', (socket) => {
      this.logger.info(`Client connected: ${socket.id}`);
      
      socket.on('request:stats', () => {
        socket.emit('stats:update', {
          totalEmails: Math.floor(Math.random() * 1000),
          emailsToday: Math.floor(Math.random() * 100),
          activeDevices: Math.floor(Math.random() * 10),
          queueSize: Math.floor(Math.random() * 20),
          successRate: 85 + Math.random() * 10,
          avgProcessingTime: Math.floor(Math.random() * 5000)
        });
      });

      socket.on('disconnect', () => {
        this.logger.info(`Client disconnected: ${socket.id}`);
      });
    });
  }

  start(port = 3001) {
    this.server.listen(port, () => {
      this.logger.info(`API Server running on port ${port}`);
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
  }
}

module.exports = SimpleAPIServer;