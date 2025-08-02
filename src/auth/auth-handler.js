const ipRangeCheck = require('ip-range-check');

class AuthHandler {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.staticUsers = this.loadStaticUsers();
  }
  
  loadStaticUsers() {
    const users = new Map();
    
    if (this.config.legacy_auth?.static_users) {
      this.config.legacy_auth.static_users.forEach(user => {
        users.set(user.username, {
          password: user.password,
          allowedIps: user.allowed_ips || []
        });
      });
    }
    
    return users;
  }
  
  checkIPAccess(clientIP, listener) {
    // Check blacklist first
    if (this.config.ip_whitelist?.blacklist?.length > 0) {
      if (ipRangeCheck(clientIP, this.config.ip_whitelist.blacklist)) {
        this.logger.warn(`IP ${clientIP} is blacklisted`);
        return false;
      }
    }
    
    // For port 25, check if IP is in no-auth whitelist
    if (listener.port === 25 && this.config.ip_whitelist?.no_auth_required) {
      if (ipRangeCheck(clientIP, this.config.ip_whitelist.no_auth_required)) {
        this.logger.info(`IP ${clientIP} allowed without auth on port 25`);
        return true;
      }
    }
    
    // If no specific whitelist, allow all (except blacklisted)
    return true;
  }
  
  authenticate(auth, session, callback, listener) {
    const clientIP = session.remoteAddress;
    const username = auth.username;
    const password = auth.password;
    
    this.logger.info(`Auth attempt from ${clientIP} as ${username} on port ${listener.port}`);
    
    // Check if this IP needs auth at all
    if (this.config.ip_whitelist?.no_auth_required) {
      if (ipRangeCheck(clientIP, this.config.ip_whitelist.no_auth_required)) {
        this.logger.info(`IP ${clientIP} bypassed auth - whitelisted`);
        return callback(null, { user: 'ip-whitelist' });
      }
    }
    
    // Validate against static users
    if (this.staticUsers.has(username)) {
      const user = this.staticUsers.get(username);
      
      // Check password
      if (user.password !== password) {
        this.logger.warn(`Invalid password for user ${username} from ${clientIP}`);
        if (this.config.logging.log_auth_failures) {
          this.logAuthFailure(username, clientIP, 'invalid_password');
        }
        return callback(new Error('Invalid credentials'));
      }
      
      // Check IP restrictions for this user
      if (user.allowedIps.length > 0) {
        if (!ipRangeCheck(clientIP, user.allowedIps)) {
          this.logger.warn(`User ${username} not allowed from IP ${clientIP}`);
          if (this.config.logging.log_auth_failures) {
            this.logAuthFailure(username, clientIP, 'ip_not_allowed');
          }
          return callback(new Error('Access denied from this IP'));
        }
      }
      
      this.logger.info(`Successful auth for ${username} from ${clientIP}`);
      return callback(null, { user: username });
    }
    
    // Legacy fallback - accept any auth for testing
    if (this.config.legacy?.relaxed_smtp && listener.port !== 25) {
      this.logger.warn(`Accepting auth in relaxed mode for ${username}`);
      return callback(null, { user: username });
    }
    
    this.logger.warn(`Unknown user ${username} from ${clientIP}`);
    if (this.config.logging.log_auth_failures) {
      this.logAuthFailure(username, clientIP, 'unknown_user');
    }
    callback(new Error('Invalid credentials'));
  }
  
  logAuthFailure(username, ip, reason) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} AUTH_FAILURE user=${username} ip=${ip} reason=${reason}\n`;
    
    // Write to separate auth failure log if configured
    if (this.config.logging.auth_failure_log) {
      require('fs').appendFileSync(
        this.config.logging.auth_failure_log,
        logEntry
      );
    }
  }
}

module.exports = { AuthHandler };