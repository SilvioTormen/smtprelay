const { 
  DeviceCodeCredential,
  ClientSecretCredential,
  AuthorizationCodeCredential,
  InteractiveBrowserCredential 
} = require('@azure/identity');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * OAuth2 Flow Manager for Exchange Online
 * Supports multiple authentication flows:
 * - Device Code Flow (for headless server setup)
 * - Authorization Code Flow (for web dashboard)
 * - Client Credentials Flow (for service-to-service)
 */
class OAuth2FlowManager {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.tokenCache = new Map();
    this.refreshTokens = new Map();
    this.tokenFilePath = path.join(__dirname, '../../.tokens.json');
  }

  /**
   * Device Code Flow - Perfect for initial server setup
   * User authorizes on another device using a code
   */
  async initializeDeviceCodeFlow() {
    const tenantId = this.config.auth.tenant_id || 'common';
    const clientId = this.config.auth.client_id;
    
    // Validate configuration
    if (!clientId || clientId === 'your-client-id') {
      throw new Error('Invalid Client ID. Please configure a valid Azure AD Application ID');
    }
    
    if (!tenantId || tenantId === 'your-tenant-id') {
      throw new Error('Invalid Tenant ID. Please configure a valid Azure AD Tenant ID or use "common"');
    }
    
    this.logger.info('Starting Device Code Flow...');
    this.logger.info(`Tenant ID: ${tenantId}`);
    this.logger.info(`Client ID: ${clientId}`);
    
    const credential = new DeviceCodeCredential({
      tenantId,
      clientId,
      userPromptCallback: (info) => {
        // Check if info is properly received
        if (!info || !info.verificationUri || !info.userCode) {
          console.error('\n❌ Error: Device code information not received properly');
          console.error('This usually indicates:');
          console.error('1. Invalid Client ID or Tenant ID');
          console.error('2. Application not properly configured in Azure AD');
          console.error('3. Network connectivity issues\n');
          console.error('Debug info:', JSON.stringify(info, null, 2));
          return;
        }
        
        // Display the device code to the user
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔐 DEVICE CODE AUTHENTICATION REQUIRED');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\nTo authenticate, follow these steps:\n');
        console.log(`1. Open your browser and go to: ${info.verificationUri || 'https://microsoft.com/devicelogin'}`);
        console.log(`2. Enter this code: ${info.userCode}`);
        console.log(`3. Sign in with your Microsoft 365 account`);
        console.log(`4. Grant permissions to the SMTP Relay application\n`);
        console.log('Waiting for authentication...');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    });

    try {
      // Determine scopes based on configured method
      let scopes = ['offline_access'];
      
      const apiMethod = this.config.method || 'graph_api';
      
      if (apiMethod === 'graph_api') {
        // Only Graph API scope
        scopes.unshift('https://graph.microsoft.com/Mail.Send');
        this.logger.info('Using Graph API scopes only');
      } else if (apiMethod === 'smtp_oauth2') {
        // Only SMTP scope
        scopes.unshift('https://outlook.office365.com/SMTP.Send');
        this.logger.info('Using SMTP OAuth2 scopes only');
      } else if (apiMethod === 'hybrid') {
        // Both scopes for hybrid mode
        scopes.unshift('https://outlook.office365.com/SMTP.Send');
        scopes.unshift('https://graph.microsoft.com/Mail.Send');
        this.logger.info('Using hybrid mode with both scopes');
      }
      
      this.logger.info(`Requesting scopes: ${scopes.join(', ')}`);
      
      // Request token with appropriate scopes
      const tokenResponse = await credential.getToken(scopes);

      if (tokenResponse) {
        this.logger.info('✅ Device Code authentication successful!');
        
        // Save the refresh token for future use
        await this.saveTokens({
          accessToken: tokenResponse.token,
          expiresOn: tokenResponse.expiresOnTimestamp,
          refreshToken: tokenResponse.refreshToken || null,
          authMethod: 'device_code',
          clientId,
          tenantId
        });

        return {
          success: true,
          accessToken: tokenResponse.token,
          expiresOn: tokenResponse.expiresOnTimestamp
        };
      }
    } catch (error) {
      this.logger.error(`Device Code Flow failed: ${error.message}`);
      
      // Provide more detailed error information
      if (error.message && error.message.includes('invalid_grant')) {
        console.error('\n❌ Authentication Error: Invalid Grant');
        console.error('This typically means:');
        console.error('1. The Tenant ID format is incorrect (should be a GUID or "common")');
        console.error('2. The Client ID is not valid for this tenant');
        console.error('3. The application is not properly registered in Azure AD');
        console.error('\nPlease verify:');
        console.error(`- Tenant ID: ${tenantId} (should be like "12345678-1234-1234-1234-123456789012" or "common")`);
        console.error(`- Client ID: ${clientId} (should be the Application ID from Azure AD)`);
        console.error('- The app has "SMTP.Send" API permission in Azure AD');
        console.error('- Public client flow is enabled in Azure AD app settings\n');
      } else if (error.message && error.message.includes('AADSTS')) {
        // Parse Azure AD error codes
        const errorCode = error.message.match(/AADSTS(\d+)/)?.[1];
        console.error(`\n❌ Azure AD Error Code: AADSTS${errorCode}`);
        console.error('Check Microsoft documentation for this error code');
      } else if (error.message && error.message.includes('post_request_failed')) {
        console.error('\n❌ Network Error: Cannot reach Azure AD');
        console.error('This could mean:');
        console.error('1. Network connectivity issues');
        console.error('2. Firewall blocking Azure AD endpoints');
        console.error('3. Invalid Tenant ID format');
        console.error('\nPlease check:');
        console.error('- Internet connectivity');
        console.error('- Firewall allows HTTPS to login.microsoftonline.com');
        console.error(`- Tenant ID format: "${tenantId}"`);
      }
      
      throw error;
    }
  }

  /**
   * Authorization Code Flow - For web dashboard with user login
   * Implements full OAuth2 authorization code flow with PKCE
   */
  async setupAuthorizationCodeFlow(app) {
    const tenantId = this.config.auth.tenant_id || 'common';
    const clientId = this.config.auth.client_id;
    const clientSecret = this.config.auth.client_secret;
    const redirectUri = this.config.auth.redirect_uri || 'http://localhost:3001/api/auth/callback';
    
    // Store for authorization requests (state -> code_verifier)
    const authRequests = new Map();

    // Login endpoint - initiates OAuth2 flow
    app.get('/api/auth/microsoft/login', (req, res) => {
      // Generate state and PKCE code verifier
      const state = crypto.randomBytes(32).toString('base64url');
      const codeVerifier = crypto.randomBytes(32).toString('base64url');
      const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

      // Store for callback
      authRequests.set(state, {
        codeVerifier,
        timestamp: Date.now(),
        userId: req.query.userId || null
      });

      // Clean old requests (older than 10 minutes)
      for (const [key, value] of authRequests.entries()) {
        if (Date.now() - value.timestamp > 600000) {
          authRequests.delete(key);
        }
      }

      // Build authorization URL
      const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_mode', 'query');
      authUrl.searchParams.append('scope', [
        'openid',
        'profile',
        'email',
        'offline_access',
        'https://outlook.office365.com/SMTP.Send',
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/User.Read'
      ].join(' '));
      authUrl.searchParams.append('state', state);
      authUrl.searchParams.append('code_challenge', codeChallenge);
      authUrl.searchParams.append('code_challenge_method', 'S256');
      authUrl.searchParams.append('prompt', 'select_account');

      this.logger.info('Redirecting user to Microsoft login...');
      res.redirect(authUrl.toString());
    });

    // Callback endpoint - handles OAuth2 callback
    app.get('/api/auth/callback', async (req, res) => {
      const { code, state, error, error_description } = req.query;

      if (error) {
        this.logger.error(`OAuth2 error: ${error} - ${error_description}`);
        return res.status(400).json({ 
          error: 'Authentication failed', 
          details: error_description 
        });
      }

      // Verify state
      const authRequest = authRequests.get(state);
      if (!authRequest) {
        return res.status(400).json({ error: 'Invalid state parameter' });
      }

      authRequests.delete(state);

      try {
        // Exchange authorization code for tokens
        const credential = new AuthorizationCodeCredential({
          tenantId,
          clientId,
          clientSecret,
          authorizationCode: code,
          redirectUri
        });

        const tokenResponse = await credential.getToken([
          'https://outlook.office365.com/SMTP.Send',
          'https://graph.microsoft.com/Mail.Send'
        ]);

        if (tokenResponse) {
          // Get user information
          const authProvider = new TokenCredentialAuthenticationProvider(credential, {
            scopes: ['https://graph.microsoft.com/.default']
          });

          const graphClient = Client.initWithMiddleware({ authProvider });
          const user = await graphClient.api('/me').get();

          this.logger.info(`User ${user.mail || user.userPrincipalName} authenticated successfully`);

          // Save tokens
          await this.saveTokens({
            accessToken: tokenResponse.token,
            expiresOn: tokenResponse.expiresOnTimestamp,
            refreshToken: tokenResponse.refreshToken || null,
            authMethod: 'authorization_code',
            clientId,
            tenantId,
            user: {
              id: user.id,
              email: user.mail || user.userPrincipalName,
              displayName: user.displayName
            }
          });

          // Return success page or redirect to dashboard
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Authentication Successful</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  margin: 0;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .success-box {
                  background: white;
                  padding: 40px;
                  border-radius: 10px;
                  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                  text-align: center;
                  max-width: 400px;
                }
                h1 { color: #10b981; margin-bottom: 10px; }
                p { color: #6b7280; margin-bottom: 20px; }
                .user-info {
                  background: #f3f4f6;
                  padding: 15px;
                  border-radius: 5px;
                  margin: 20px 0;
                }
                button {
                  background: #667eea;
                  color: white;
                  border: none;
                  padding: 12px 24px;
                  border-radius: 5px;
                  cursor: pointer;
                  font-size: 16px;
                }
                button:hover { background: #5a67d8; }
              </style>
            </head>
            <body>
              <div class="success-box">
                <h1>✅ Authentication Successful!</h1>
                <p>You have successfully authenticated with Microsoft 365.</p>
                <div class="user-info">
                  <strong>${user.displayName}</strong><br>
                  ${user.mail || user.userPrincipalName}
                </div>
                <button onclick="window.close()">Close Window</button>
              </div>
              <script>
                // Send message to parent window if opened as popup
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'auth_success',
                    user: ${JSON.stringify({
                      id: user.id,
                      email: user.mail || user.userPrincipalName,
                      displayName: user.displayName
                    })}
                  }, '*');
                  setTimeout(() => window.close(), 3000);
                }
              </script>
            </body>
            </html>
          `);
        }
      } catch (error) {
        this.logger.error(`Token exchange failed: ${error.message}`);
        res.status(500).json({ 
          error: 'Failed to exchange authorization code',
          details: error.message 
        });
      }
    });

    this.logger.info('Authorization Code Flow endpoints configured');
  }

  /**
   * Client Credentials Flow - Service-to-service authentication
   * No user interaction required
   */
  async getClientCredentialsToken() {
    const tenantId = this.config.auth.tenant_id;
    const clientId = this.config.auth.client_id;
    const clientSecret = this.config.auth.client_secret;

    const credential = new ClientSecretCredential(
      tenantId,
      clientId,
      clientSecret
    );

    try {
      const tokenResponse = await credential.getToken([
        'https://outlook.office365.com/.default'
      ]);

      if (tokenResponse) {
        this.logger.info('Client Credentials token obtained successfully');
        
        await this.saveTokens({
          accessToken: tokenResponse.token,
          expiresOn: tokenResponse.expiresOnTimestamp,
          authMethod: 'client_credentials',
          clientId,
          tenantId
        });

        return {
          success: true,
          accessToken: tokenResponse.token,
          expiresOn: tokenResponse.expiresOnTimestamp
        };
      }
    } catch (error) {
      this.logger.error(`Client Credentials Flow failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current valid token or refresh if needed
   */
  async getValidToken(authMethod = null) {
    try {
      const tokens = await this.loadTokens();
      
      if (!tokens || !tokens.accessToken) {
        throw new Error('No stored tokens found. Please authenticate first.');
      }

      // Check if token is still valid (with 5 minute buffer)
      const now = Date.now();
      const expiresOn = tokens.expiresOn || 0;
      
      if (now < (expiresOn - 300000)) {
        // Token is still valid
        return tokens.accessToken;
      }

      // Token expired or expiring soon - need to refresh
      this.logger.info('Token expired or expiring soon, attempting refresh...');
      
      // Refresh based on auth method
      if (tokens.authMethod === 'client_credentials') {
        const result = await this.getClientCredentialsToken();
        return result.accessToken;
      } else if (tokens.refreshToken) {
        // Use refresh token for device code or auth code flows
        return await this.refreshWithToken(tokens.refreshToken);
      } else {
        throw new Error('No refresh token available. Please re-authenticate.');
      }
    } catch (error) {
      this.logger.error(`Failed to get valid token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh token using refresh token
   */
  async refreshWithToken(refreshToken) {
    const tenantId = this.config.auth.tenant_id || 'common';
    const clientId = this.config.auth.client_id;
    const clientSecret = this.config.auth.client_secret;

    try {
      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams({
        client_id: clientId,
        scope: 'https://outlook.office365.com/SMTP.Send https://graph.microsoft.com/Mail.Send offline_access',
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      if (clientSecret) {
        params.append('client_secret', clientSecret);
      }

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Save new tokens
      await this.saveTokens({
        accessToken: data.access_token,
        expiresOn: Date.now() + (data.expires_in * 1000),
        refreshToken: data.refresh_token || refreshToken,
        authMethod: 'refreshed',
        clientId,
        tenantId
      });

      this.logger.info('Token refreshed successfully');
      return data.access_token;
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save tokens to file
   */
  async saveTokens(tokenData) {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.tokenFilePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Save with restricted permissions (owner read/write only)
      await fs.writeFile(
        this.tokenFilePath,
        JSON.stringify(tokenData, null, 2),
        { 
          encoding: 'utf8',
          mode: 0o600  // Only owner can read/write
        }
      );
      this.logger.info('Tokens saved successfully with restricted permissions');
    } catch (error) {
      this.logger.error(`Failed to save tokens: ${error.message}`);
      this.logger.error('Ensure the service has write permissions to the token file');
      throw error;  // Re-throw to prevent silent failure
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
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to load tokens: ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Clear stored tokens
   */
  async clearTokens() {
    try {
      await fs.unlink(this.tokenFilePath);
      this.logger.info('Tokens cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(`Failed to clear tokens: ${error.message}`);
      }
    }
  }
}

module.exports = { OAuth2FlowManager };