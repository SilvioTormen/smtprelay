const { ClientSecretCredential } = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');

class ExchangeAuth {
  constructor(config, logger) {
    this.config = config.exchange_online;
    this.logger = logger;
    this.accessToken = null;
    this.tokenExpiry = null;
  }
  
  async getAuthConfig() {
    // Check which auth method to use
    if (this.config.auth.method === 'oauth2') {
      return await this.getOAuth2Config();
    } else if (this.config.auth.method === 'basic') {
      return this.getBasicAuthConfig();
    } else {
      throw new Error(`Unknown auth method: ${this.config.auth.method}`);
    }
  }
  
  getBasicAuthConfig() {
    // Simple username/password auth (using app password)
    this.logger.info('Using basic auth for Exchange Online');
    
    return {
      user: this.config.auth.username,
      pass: this.config.auth.password
    };
  }
  
  async getOAuth2Config() {
    this.logger.info('Using OAuth2 for Exchange Online');
    
    try {
      // Get access token if needed
      if (!this.accessToken || this.isTokenExpired()) {
        await this.refreshAccessToken();
      }
      
      return {
        type: 'OAuth2',
        user: this.config.auth.username || this.config.auth.client_id,
        accessToken: this.accessToken
      };
    } catch (error) {
      this.logger.error(`OAuth2 auth failed: ${error.message}`);
      
      // Fallback to basic auth if configured
      if (this.config.auth.username && this.config.auth.password) {
        this.logger.warn('Falling back to basic auth');
        return this.getBasicAuthConfig();
      }
      
      throw error;
    }
  }
  
  async refreshAccessToken() {
    try {
      const credential = new ClientSecretCredential(
        this.config.auth.tenant_id,
        this.config.auth.client_id,
        this.config.auth.client_secret
      );
      
      // Get token for SMTP
      const tokenResponse = await credential.getToken('https://outlook.office365.com/.default');
      
      this.accessToken = tokenResponse.token;
      this.tokenExpiry = tokenResponse.expiresOnTimestamp;
      
      this.logger.info(`OAuth2 token obtained, expires at ${new Date(this.tokenExpiry)}`);
      
      // Schedule token refresh before expiry
      const refreshTime = this.tokenExpiry - Date.now() - 300000; // 5 minutes before expiry
      if (refreshTime > 0) {
        setTimeout(() => this.refreshAccessToken(), refreshTime);
      }
    } catch (error) {
      this.logger.error(`Failed to get OAuth2 token: ${error.message}`);
      throw error;
    }
  }
  
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    
    // Check if token expires in next 5 minutes
    return Date.now() > (this.tokenExpiry - 300000);
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