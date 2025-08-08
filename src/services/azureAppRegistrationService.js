const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class AzureAppRegistrationService {
  constructor(logger = console) {
    this.logger = logger;
    this.adminTokens = new Map(); // Store admin tokens temporarily
  }

  /**
   * Initiate admin authentication flow
   */
  async initiateAdminAuth(redirectUri) {
    const state = uuidv4();
    const nonce = uuidv4();
    
    // Microsoft Graph permissions needed for app registration
    const scopes = [
      'Application.ReadWrite.All',     // Create and manage applications
      'AppRoleAssignment.ReadWrite.All', // Grant permissions
      'Directory.ReadWrite.All',       // Read directory info
      'User.Read'                      // Basic user info
    ].join(' ');

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', process.env.AZURE_ADMIN_CLIENT_ID || 'your-admin-client-id');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_mode', 'query');
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    // Don't use admin_consent prompt here - just login normally
    authUrl.searchParams.set('prompt', 'select_account');

    return {
      success: true,
      authUrl: authUrl.toString(),
      state,
      nonce
    };
  }

  /**
   * Handle admin authentication callback
   */
  async handleAdminCallback(code, state, redirectUri) {
    try {
      const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.AZURE_ADMIN_CLIENT_ID || 'your-admin-client-id',
          client_secret: process.env.AZURE_ADMIN_CLIENT_SECRET || 'your-admin-client-secret',
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        throw new Error(`Token exchange failed: ${tokenData.error_description || tokenData.error}`);
      }

      // Get admin user info
      const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const userData = await userResponse.json();

      if (!userResponse.ok) {
        throw new Error(`Failed to get user info: ${userData.error?.message || 'Unknown error'}`);
      }

      // Verify admin privileges
      const rolesResponse = await fetch('https://graph.microsoft.com/v1.0/me/memberOf', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });

      const rolesData = await rolesResponse.json();
      const hasAdminRole = rolesData.value?.some(role => 
        role.displayName?.includes('Global Administrator') ||
        role.displayName?.includes('Application Administrator')
      );

      if (!hasAdminRole) {
        throw new Error('Global Administrator or Application Administrator role required');
      }

      const adminAuth = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        tenantId: userData.businessPhones?.[0] || 'common', // Extract tenant from user data
        userPrincipalName: userData.userPrincipalName,
        displayName: userData.displayName,
        id: userData.id
      };

      // Store temporarily (in production, use secure session storage)
      this.adminTokens.set(state, adminAuth);

      return {
        success: true,
        adminAuth
      };
    } catch (error) {
      this.logger.error('Admin callback error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create Azure AD application automatically
   */
  async createApplication(appConfig, adminToken, progressCallback) {
    const steps = [
      'Authenticating admin user',
      'Creating Azure AD application',
      'Configuring permissions',
      'Setting up redirect URIs',
      'Granting admin consent',
      'Saving configuration'
    ];

    try {
      // Step 1: Verify admin token
      progressCallback('Authenticating admin user', 'in_progress');
      await this.verifyAdminToken(adminToken);
      progressCallback('Authenticating admin user', 'complete');

      // Step 2: Create application
      progressCallback('Creating Azure AD application', 'in_progress');
      const app = await this.createAzureApplication(appConfig, adminToken);
      progressCallback('Creating Azure AD application', 'complete');

      // Step 3: Configure permissions
      progressCallback('Configuring permissions', 'in_progress');
      await this.configureApplicationPermissions(app.id, appConfig.requiredResourceAccess, adminToken);
      progressCallback('Configuring permissions', 'complete');

      // Step 4: Setup redirect URIs
      progressCallback('Setting up redirect URIs', 'in_progress');
      await this.updateRedirectUris(app.id, appConfig.redirectUris, adminToken);
      progressCallback('Setting up redirect URIs', 'complete');

      // Step 5: Grant admin consent
      progressCallback('Granting admin consent', 'in_progress');
      await this.grantAdminConsent(app.appId, adminToken);
      progressCallback('Granting admin consent', 'complete');

      // Step 6: Generate client secret
      progressCallback('Generating client secret', 'in_progress');
      const clientSecret = await this.createClientSecret(app.id, adminToken);
      progressCallback('Generating client secret', 'complete');

      // Step 7: Save configuration
      progressCallback('Saving configuration', 'in_progress');
      await this.saveApplicationConfig(app, clientSecret);
      progressCallback('Saving configuration', 'complete');

      return {
        success: true,
        appRegistration: {
          id: app.id,
          appId: app.appId,
          displayName: app.displayName,
          tenantId: this.extractTenantFromToken(adminToken),
          clientSecret: clientSecret.value,
          secretId: clientSecret.keyId,
          createdDateTime: app.createdDateTime
        }
      };

    } catch (error) {
      this.logger.error('Application creation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify admin token is still valid
   */
  async verifyAdminToken(adminToken) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Admin token is invalid or expired');
    }

    return await response.json();
  }

  /**
   * Create Azure AD application
   */
  async createAzureApplication(appConfig, adminToken) {
    const applicationData = {
      displayName: appConfig.displayName,
      description: 'SMTP Relay application for Exchange Online integration',
      signInAudience: 'AzureADMyOrg',
      web: {
        redirectUris: appConfig.redirectUris || [],
        implicitGrantSettings: {
          enableIdTokenIssuance: true,
          enableAccessTokenIssuance: false
        }
      },
      requiredResourceAccess: appConfig.requiredResourceAccess || [
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: [
            {
              id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
              type: 'Scope'
            },
            {
              id: 'b633e1c5-b582-4048-a93e-9f11b44c7e96', // Mail.Send
              type: 'Role'
            }
          ]
        }
      ],
      tags: ['smtp-relay', 'exchange-online', 'automated-setup']
    };

    const response = await fetch('https://graph.microsoft.com/v1.0/applications', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(applicationData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to create application: ${result.error?.message || 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Configure application permissions
   */
  async configureApplicationPermissions(appObjectId, requiredResourceAccess, adminToken) {
    const updateData = {
      requiredResourceAccess
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/applications/${appObjectId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to configure permissions: ${error.error?.message || 'Unknown error'}`);
    }

    return true;
  }

  /**
   * Update redirect URIs
   */
  async updateRedirectUris(appObjectId, redirectUris, adminToken) {
    const updateData = {
      web: {
        redirectUris
      }
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/applications/${appObjectId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update redirect URIs: ${error.error?.message || 'Unknown error'}`);
    }

    return true;
  }

  /**
   * Grant admin consent for the application
   */
  async grantAdminConsent(appId, adminToken) {
    // First, create a service principal for the application
    const spResponse = await fetch('https://graph.microsoft.com/v1.0/servicePrincipals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        appId: appId
      })
    });

    if (!spResponse.ok && spResponse.status !== 409) { // 409 means already exists
      const error = await spResponse.json();
      throw new Error(`Failed to create service principal: ${error.error?.message || 'Unknown error'}`);
    }

    const spData = spResponse.status === 409 ? 
      await this.getExistingServicePrincipal(appId, adminToken) :
      await spResponse.json();

    // Grant admin consent by creating oauth2PermissionGrants
    const graphSpResponse = await fetch('https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq \'00000003-0000-0000-c000-000000000000\'', {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const graphSpData = await graphSpResponse.json();
    const graphServicePrincipal = graphSpData.value[0];

    if (!graphServicePrincipal) {
      throw new Error('Could not find Microsoft Graph service principal');
    }

    // Grant delegated permissions
    const consentResponse = await fetch('https://graph.microsoft.com/v1.0/oauth2PermissionGrants', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clientId: spData.id,
        resourceId: graphServicePrincipal.id,
        scope: 'User.Read Mail.Send',
        consentType: 'AllPrincipals'
      })
    });

    if (!consentResponse.ok && consentResponse.status !== 409) {
      const error = await consentResponse.json();
      this.logger.warn('Admin consent warning:', error);
      // Continue even if consent fails - user can grant manually
    }

    return true;
  }

  /**
   * Get existing service principal
   */
  async getExistingServicePrincipal(appId, adminToken) {
    const response = await fetch(`https://graph.microsoft.com/v1.0/servicePrincipals?$filter=appId eq '${appId}'`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    const data = await response.json();
    return data.value[0];
  }

  /**
   * Create client secret for the application
   */
  async createClientSecret(appObjectId, adminToken) {
    const secretData = {
      passwordCredential: {
        displayName: 'SMTP Relay Secret',
        endDateTime: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
      }
    };

    const response = await fetch(`https://graph.microsoft.com/v1.0/applications/${appObjectId}/addPassword`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(secretData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to create client secret: ${result.error?.message || 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Save application configuration to config.yml
   */
  async saveApplicationConfig(app, clientSecret) {
    const fs = require('fs').promises;
    const path = require('path');
    const yaml = require('yaml');

    const configPath = path.join(process.cwd(), 'config.yml');
    let config = {};

    // Load existing config
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      config = yaml.parse(configContent);
    } catch (error) {
      // Config doesn't exist, create new
    }

    // Update Exchange Online configuration
    config.exchange_online = {
      ...config.exchange_online,
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        method: 'device_code',
        tenant_id: this.extractTenantFromApp(app),
        client_id: app.appId,
        client_secret: clientSecret.secretValue
      },
      api_method: 'graph_api',
      auto_configured: true,
      configured_at: new Date().toISOString()
    };

    // Save config
    await fs.writeFile(configPath, yaml.stringify(config), 'utf8');
    return true;
  }

  /**
   * Setup service account configuration
   */
  async setupServiceAccount(appId, tenantId, serviceAccount, adminToken) {
    try {
      // Verify service account exists in directory
      const userResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${serviceAccount}`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (!userResponse.ok) {
        throw new Error('Service account not found in directory');
      }

      const userData = await userResponse.json();

      // Verify user has Exchange Online license
      const licensesResponse = await fetch(`https://graph.microsoft.com/v1.0/users/${serviceAccount}/licenseDetails`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });

      if (licensesResponse.ok) {
        const licensesData = await licensesResponse.json();
        const hasExchangeLicense = licensesData.value?.some(license => 
          license.servicePlans?.some(plan => 
            plan.servicePlanName?.includes('EXCHANGE') && plan.provisioningStatus === 'Success'
          )
        );

        if (!hasExchangeLicense) {
          this.logger.warn('Service account may not have Exchange Online license');
        }
      }

      return {
        success: true,
        serviceAccount: {
          userPrincipalName: userData.userPrincipalName,
          displayName: userData.displayName,
          id: userData.id,
          mail: userData.mail
        }
      };

    } catch (error) {
      this.logger.error('Service account setup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test the configuration
   */
  async testConfiguration(appId, tenantId, serviceAccount) {
    try {
      // Test by attempting to get an access token
      const tokenResponse = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: appId,
          scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
        })
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to initiate device code flow');
      }

      return {
        success: true,
        message: 'Configuration test successful',
        serviceAccount,
        tenantId,
        permissions: ['User.Read', 'Mail.Send']
      };

    } catch (error) {
      this.logger.error('Configuration test error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract tenant ID from token
   */
  extractTenantFromToken(token) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.tid || payload.aud || 'common';
    } catch (error) {
      return 'common';
    }
  }

  /**
   * Extract tenant ID from app object
   */
  extractTenantFromApp(app) {
    // In a real scenario, we would extract this from the admin token or API response
    // For now, we'll use 'common' and let the user configure it
    return process.env.AZURE_TENANT_ID || 'common';
  }

  /**
   * Clean up stored admin tokens (call periodically)
   */
  cleanupExpiredTokens() {
    const now = new Date();
    for (const [key, token] of this.adminTokens.entries()) {
      if (token.expiresAt < now) {
        this.adminTokens.delete(key);
      }
    }
  }
}

module.exports = AzureAppRegistrationService;