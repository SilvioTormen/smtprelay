const { OAuth2FlowManager } = require('./oauth2-flows');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const { ClientSecretCredential } = require('@azure/identity');

class ExchangeAuth {
  constructor(config, logger) {
    this.config = config.exchange_online;
    this.logger = logger;
    this.accessToken = null;
    this.tokenExpiry = null;
    this.oauth2Manager = new OAuth2FlowManager(this.config, logger);
  }
  
  async getAuthConfig() {
    // Check which auth method to use
    const method = this.config.auth.method;
    
    switch(method) {
      case 'device_code':
        return await this.getDeviceCodeConfig();
      case 'authorization_code':
        return await this.getAuthCodeConfig();
      default:
        throw new Error(`Unknown auth method: ${method}. Supported: device_code, authorization_code`);
    }
  }
  
  async getDeviceCodeConfig() {
    this.logger.info('Using Device Code Flow for Exchange Online');
    
    try {
      // Get token using device code flow
      const token = await this.oauth2Manager.getValidToken('device_code');
      
      return {
        type: 'OAuth2',
        user: this.config.auth.send_as || this.config.auth.client_id,
        accessToken: token
      };
    } catch (error) {
      this.logger.error(`Device Code auth failed: ${error.message}`);
      throw error;
    }
  }
  
  async getAuthCodeConfig() {
    this.logger.info('Using Authorization Code Flow for Exchange Online');
    
    try {
      // Get token using authorization code flow
      const token = await this.oauth2Manager.getValidToken('authorization_code');
      
      return {
        type: 'OAuth2',
        user: this.config.auth.send_as || this.config.auth.client_id,
        accessToken: token
      };
    } catch (error) {
      this.logger.error(`Authorization Code auth failed: ${error.message}`);
      throw error;
    }
  }
  
  
  async initializeAuth() {
    const method = this.config.auth.method;
    
    try {
      switch(method) {
        case 'device_code':
          // Initialize device code flow for first-time setup
          const result = await this.oauth2Manager.initializeDeviceCodeFlow();
          this.logger.info('Device Code authentication completed successfully');
          return result;
          
        default:
          this.logger.info(`Auth method ${method} does not require initialization`);
          return { success: true };
      }
    } catch (error) {
      this.logger.error(`Authentication initialization failed: ${error.message}`);
      throw error;
    }
  }
  
  async setupAuthorizationCodeEndpoints(app) {
    // Setup OAuth2 authorization code flow endpoints for web dashboard
    await this.oauth2Manager.setupAuthorizationCodeFlow(app);
  }
  
  async clearStoredTokens() {
    // Clear all stored tokens (for logout or reset)
    await this.oauth2Manager.clearTokens();
  }
  
  // Alternative: Use Microsoft Graph for sending (if SMTP is blocked)
  async sendViaGraph(mailData) {
    try {
      const credential = new ClientSecretCredential(
        this.config.auth.tenant_id,
        this.config.auth.client_id,
        this.config.auth.client_secret
      );
      
      const authProvider = new TokenCredentialAuthenticationProvider(credential, {
        scopes: ['https://graph.microsoft.com/.default']
      });
      
      const client = Client.initWithMiddleware({
        authProvider
      });
      
      const message = {
        subject: mailData.subject,
        body: {
          contentType: mailData.html ? 'HTML' : 'Text',
          content: mailData.html || mailData.text
        },
        toRecipients: mailData.to.map(email => ({
          emailAddress: { address: email }
        })),
        from: {
          emailAddress: { address: mailData.from }
        }
      };
      
      // Send using Graph API
      await client.api(`/users/${this.config.auth.username}/sendMail`)
        .post({ message, saveToSentItems: false });
      
      this.logger.info('Message sent via Microsoft Graph API');
    } catch (error) {
      this.logger.error(`Graph API send failed: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { ExchangeAuth };