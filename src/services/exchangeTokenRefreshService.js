const path = require('path');
const fs = require('fs').promises;

/**
 * Exchange Token Refresh Service
 * Automatically refreshes Microsoft Exchange/Office 365 tokens before they expire
 */
class ExchangeTokenRefreshService {
  constructor(oauth2Manager, logger) {
    this.oauth2Manager = oauth2Manager;
    this.logger = logger;
    this.refreshInterval = null;
    this.tokenFilePath = path.join(process.cwd(), '.tokens.json');
  }

  /**
   * Start the automatic token refresh service
   */
  async start() {
    try {
      // Check if we have tokens to refresh
      const tokens = await this.loadTokens();
      
      if (!tokens || !tokens.accessToken) {
        this.logger.info('No Exchange tokens found to refresh. Service will start after initial authentication.');
        return;
      }

      // Calculate when to refresh (10 minutes before expiry)
      const now = Date.now();
      const expiresOn = tokens.expiresOn || 0;
      const timeUntilExpiry = expiresOn - now;
      const refreshBuffer = 10 * 60 * 1000; // 10 minutes
      
      if (timeUntilExpiry <= 0) {
        // Token already expired, refresh immediately
        this.logger.info('Exchange token expired, refreshing immediately...');
        await this.refreshToken();
      } else if (timeUntilExpiry <= refreshBuffer) {
        // Token expiring soon, refresh immediately
        this.logger.info(`Exchange token expiring in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, refreshing...`);
        await this.refreshToken();
      }

      // Schedule regular refresh checks every 5 minutes
      this.refreshInterval = setInterval(async () => {
        await this.checkAndRefreshToken();
      }, 5 * 60 * 1000); // Check every 5 minutes

      this.logger.info('Exchange token refresh service started');
    } catch (error) {
      this.logger.error('Failed to start token refresh service:', error);
    }
  }

  /**
   * Stop the automatic token refresh service
   */
  stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      this.logger.info('Exchange token refresh service stopped');
    }
  }

  /**
   * Check if token needs refresh and refresh if necessary
   */
  async checkAndRefreshToken() {
    try {
      const tokens = await this.loadTokens();
      
      if (!tokens || !tokens.accessToken) {
        return; // No tokens to refresh
      }

      const now = Date.now();
      const expiresOn = tokens.expiresOn || 0;
      const timeUntilExpiry = expiresOn - now;
      const refreshBuffer = 10 * 60 * 1000; // 10 minutes

      if (timeUntilExpiry <= refreshBuffer) {
        this.logger.info(`Exchange token expiring in ${Math.round(timeUntilExpiry / 1000 / 60)} minutes, refreshing...`);
        await this.refreshToken();
      } else {
        this.logger.debug(`Exchange token valid for ${Math.round(timeUntilExpiry / 1000 / 60)} more minutes`);
      }
    } catch (error) {
      this.logger.error('Error checking token expiry:', error);
    }
  }

  /**
   * Refresh the Exchange token
   */
  async refreshToken() {
    try {
      // Use the OAuth2Manager's getValidToken which handles refresh
      const newToken = await this.oauth2Manager.getValidToken();
      
      if (newToken) {
        this.logger.info('✅ Exchange token refreshed successfully');
        
        // Log next refresh time
        const tokens = await this.loadTokens();
        if (tokens && tokens.expiresOn) {
          const nextRefresh = new Date(tokens.expiresOn - (10 * 60 * 1000));
          this.logger.info(`Next refresh scheduled for: ${nextRefresh.toLocaleString()}`);
        }
      }
    } catch (error) {
      this.logger.error('❌ Failed to refresh Exchange token:', error.message);
      
      // If refresh fails, we might need re-authentication
      if (error.message.includes('No refresh token') || error.message.includes('invalid_grant')) {
        this.logger.error('Refresh token is invalid or expired. Manual re-authentication required.');
        
        // Notify admin (you could implement email notification here)
        this.notifyAdminTokenExpired();
      }
    }
  }

  /**
   * Load tokens from file
   */
  async loadTokens() {
    try {
      const data = await fs.readFile(this.tokenFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Notify admin that token has expired and needs re-authentication
   */
  notifyAdminTokenExpired() {
    // Log critical error
    this.logger.error('🚨 CRITICAL: Exchange authentication expired!');
    this.logger.error('Action required: Please re-authenticate using the dashboard or run the setup command.');
    
    // You could implement email notification here if needed
    // For now, just log prominently
    console.error('\n' + '='.repeat(60));
    console.error('🚨 EXCHANGE AUTHENTICATION EXPIRED');
    console.error('='.repeat(60));
    console.error('The Microsoft Exchange refresh token has expired.');
    console.error('Manual re-authentication is required.');
    console.error('');
    console.error('To fix this:');
    console.error('1. Login to the dashboard as admin');
    console.error('2. Go to Settings > Exchange Setup');
    console.error('3. Re-authenticate with Microsoft');
    console.error('='.repeat(60) + '\n');
  }

  /**
   * Get token status for monitoring
   */
  async getTokenStatus() {
    try {
      const tokens = await this.loadTokens();
      
      if (!tokens || !tokens.accessToken) {
        return {
          status: 'no_token',
          message: 'No Exchange tokens configured'
        };
      }

      const now = Date.now();
      const expiresOn = tokens.expiresOn || 0;
      const timeUntilExpiry = expiresOn - now;

      if (timeUntilExpiry <= 0) {
        return {
          status: 'expired',
          message: 'Token expired',
          expiredSince: new Date(expiresOn).toISOString()
        };
      }

      const hoursRemaining = Math.round(timeUntilExpiry / 1000 / 60 / 60);
      const minutesRemaining = Math.round(timeUntilExpiry / 1000 / 60);

      return {
        status: 'valid',
        message: `Token valid for ${hoursRemaining > 0 ? `${hoursRemaining} hours` : `${minutesRemaining} minutes`}`,
        expiresAt: new Date(expiresOn).toISOString(),
        authMethod: tokens.authMethod,
        hasRefreshToken: !!tokens.refreshToken
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = ExchangeTokenRefreshService;