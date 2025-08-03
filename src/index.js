#!/usr/bin/env node

const { SMTPServer } = require('smtp-server');
const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { setupHealthCheck } = require('./lib/health');
const { AuthHandler } = require('./auth/auth-handler');
const { RelayHandler } = require('./handlers/relay-handler');
const { QueueManager } = require('./lib/queue-manager');
const APIServer = require('./api/server');

// Load configuration
const configPath = path.join(__dirname, '..', 'config.yml');
const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));

// Setup logger
const logger = winston.createLogger({
  level: config.logging.level || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new DailyRotateFile({
      filename: config.logging.file || '/var/log/smtp-relay/relay-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: `${config.logging.max_size || 100}m`,
      maxFiles: config.logging.max_files || 10
    })
  ]
});

// Initialize components
const authHandler = new AuthHandler(config, logger);
const relayHandler = new RelayHandler(config, logger);
const queueManager = new QueueManager(config, logger);

// Initialize stats collector (needed for API server)
const statsCollector = {
  getStats: () => ({
    connections: servers.length,
    messagesProcessed: 0,
    uptime: process.uptime()
  })
};

// Create SMTP servers for each listener
const servers = [];

config.smtp.listeners.forEach(listener => {
  logger.info(`Setting up SMTP listener: ${listener.name} on port ${listener.port}`);
  
  const serverOptions = {
    name: config.hostname || 'smtp-relay.local',
    banner: `${config.hostname || 'smtp-relay.local'} ESMTP Relay Service`,
    
    // Size limits
    size: (config.advanced?.max_message_size || 25) * 1024 * 1024,
    
    // Authentication
    authOptional: !listener.auth?.required,
    authMethods: listener.auth?.enabled ? listener.auth.methods : [],
    
    // Disable auth for port 25 from whitelisted IPs
    onAuth: listener.auth?.enabled ? 
      (auth, session, callback) => authHandler.authenticate(auth, session, callback, listener) : 
      null,
    
    // Connection handler
    onConnect: (session, callback) => {
      const clientIP = session.remoteAddress;
      logger.info(`Connection from ${clientIP} on port ${listener.port}`);
      
      // Check IP whitelist/blacklist
      if (!authHandler.checkIPAccess(clientIP, listener)) {
        logger.warn(`Rejected connection from ${clientIP} - not in whitelist`);
        return callback(new Error('Access denied'));
      }
      
      callback();
    },
    
    // Mail from handler
    onMailFrom: (address, session, callback) => {
      logger.info(`MAIL FROM: ${address.address} from ${session.remoteAddress}`);
      session.envelope = { from: address.address, to: [] };
      callback();
    },
    
    // Recipient handler
    onRcptTo: (address, session, callback) => {
      logger.info(`RCPT TO: ${address.address}`);
      
      // Check recipient domain restrictions
      if (!relayHandler.checkRecipient(address.address)) {
        return callback(new Error('Relay access denied for this recipient'));
      }
      
      session.envelope.to.push(address.address);
      callback();
    },
    
    // Data handler
    onData: (stream, session, callback) => {
      relayHandler.processMessage(stream, session, (err) => {
        if (err) {
          logger.error(`Failed to relay message: ${err.message}`);
          return callback(err);
        }
        logger.info(`Message accepted for relay from ${session.remoteAddress}`);
        callback();
      });
    },
    
    // Legacy support options
    logger: false,  // We use our own logger
    hideSTARTTLS: listener.tls?.enabled === false,
    disabledCommands: listener.port === 25 ? [] : [], // Allow all commands for legacy
    allowInsecureAuth: true, // For legacy devices
    closeTimeout: config.legacy?.command_timeout * 1000 || 300000
  };
  
  // TLS configuration
  if (listener.tls?.enabled) {
    const tlsOptions = {
      cert: fs.readFileSync(config.tls.cert),
      key: fs.readFileSync(config.tls.key)
    };
    
    if (listener.tls.implicit) {
      // Port 465 - Implicit TLS
      serverOptions.secure = true;
      serverOptions.secureContext = tlsOptions;
    } else if (listener.tls.starttls) {
      // Port 587 - STARTTLS
      serverOptions.secure = false;
      serverOptions.needsUpgrade = listener.tls.required;
      serverOptions.secureContext = tlsOptions;
    }
  }
  
  const server = new SMTPServer(serverOptions);
  
  server.on('error', err => {
    logger.error(`Server error on port ${listener.port}: ${err.message}`);
  });
  
  server.listen(listener.port, listener.host, () => {
    logger.info(`SMTP server listening on ${listener.host}:${listener.port} (${listener.name})`);
  });
  
  servers.push(server);
});

// Setup health check endpoint
if (config.monitoring?.health?.enabled) {
  setupHealthCheck(config.monitoring.health.port, logger);
}

// Graceful shutdown
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

function shutdown() {
  logger.info('Shutting down SMTP relay...');
  
  servers.forEach(server => {
    server.close(() => {
      logger.info('SMTP server closed');
    });
  });
  
  queueManager.stop(() => {
    logger.info('Queue manager stopped');
    process.exit(0);
  });
}

// Start queue processor
queueManager.start();

// Start API/Dashboard server
const apiServer = new APIServer(config, logger, statsCollector);
const dashboardPort = process.env.WEB_PORT || config.dashboard?.port || 3001;

apiServer.initialize().then(() => {
  apiServer.start(dashboardPort);
  logger.info(`Dashboard server started on port ${dashboardPort}`);
}).catch(err => {
  logger.error('Failed to start dashboard server:', err);
});

logger.info('Legacy SMTP Relay started successfully');