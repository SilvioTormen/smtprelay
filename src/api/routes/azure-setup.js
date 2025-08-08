const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireConfigure } = require('../middleware/rbac');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const crypto = require('crypto');
const axios = require('axios');

// Store for active device code flows
const activeFlows = new Map();

/**
 * Start Azure AD automatic setup with admin login
 */
router.post('/setup/init', authenticate, requireConfigure, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }

    // Generate a well-known client ID for initial admin authentication
    // This uses Microsoft's public client ID that's available in all tenants
    const publicClientId = '04b07795-8ddb-461a-bbee-02f9e1bf7b46'; // Microsoft Azure CLI
    
    // Start device code flow for admin authentication
    const deviceCodeUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`;
    const scope = 'https://graph.microsoft.com/Application.ReadWrite.All https://graph.microsoft.com/Directory.ReadWrite.All https://graph.microsoft.com/User.Read offline_access';
    
    const response = await axios.post(deviceCodeUrl, new URLSearchParams({
      client_id: publicClientId,
      scope: scope
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const data = response.data;
    
    if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    
    // Store the flow for polling
    const flowId = crypto.randomBytes(16).toString('hex');
    activeFlows.set(flowId, {
      deviceCode: data.device_code,
      tenantId,
      clientId: publicClientId,
      scope,
      expiresAt: Date.now() + (data.expires_in * 1000)
    });
    
    res.json({
      success: true,
      flowId,
      userCode: data.user_code,
      verificationUrl: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      message: data.message || 'Please visit the URL and enter the code to authenticate'
    });
  } catch (error) {
    console.error('Azure setup init error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Poll for admin authentication completion
 */
router.post('/setup/poll', authenticate, requireConfigure, async (req, res) => {
  try {
    const { flowId } = req.body;
    
    const flow = activeFlows.get(flowId);
    if (!flow) {
      return res.status(400).json({ error: 'Invalid or expired flow' });
    }
    
    if (Date.now() > flow.expiresAt) {
      activeFlows.delete(flowId);
      return res.status(400).json({ error: 'Device code expired' });
    }
    
    const tokenUrl = `https://login.microsoftonline.com/${flow.tenantId}/oauth2/v2.0/token`;
    
    const response = await axios.post(tokenUrl, new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: flow.deviceCode,
      client_id: flow.clientId
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    const data = response.data;
    
    if (data.error === 'authorization_pending') {
      return res.json({ 
        success: false, 
        pending: true,
        message: 'Waiting for user authorization...' 
      });
    } else if (data.error) {
      throw new Error(data.error_description || data.error);
    }
    
    // Success! Store the admin token temporarily
    flow.adminToken = data.access_token;
    flow.refreshToken = data.refresh_token;
    
    // Get admin user info
    try {
      const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${data.access_token}` }
      });
      flow.adminUser = userResponse.data;
    } catch (userError) {
      console.log('Could not get user info:', userError.message);
    }
    
    res.json({
      success: true,
      message: 'Admin authentication successful!',
      adminUser: flow.adminUser?.userPrincipalName || 'Admin'
    });
  } catch (error) {
    console.error('Azure setup poll error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create Azure AD application using admin token
 */
router.post('/setup/create-app', authenticate, requireConfigure, async (req, res) => {
  try {
    const { flowId, appConfig } = req.body;
    
    const flow = activeFlows.get(flowId);
    if (!flow || !flow.adminToken) {
      return res.status(400).json({ error: 'Admin authentication required' });
    }
    
    const {
      displayName = 'SMTP Relay for Exchange Online',
      useClientSecret = false,
      clientSecretExpiry = 365,
      authMethod = 'device_code',
      apiMethod = 'graph_api'
    } = appConfig || {};
    
    // Create application via Graph API
    const createAppUrl = 'https://graph.microsoft.com/v1.0/applications';
    
    const appPayload = {
      displayName: displayName,
      signInAudience: 'AzureADMyOrg',
      requiredResourceAccess: [
        {
          resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          resourceAccess: apiMethod === 'graph_api' ? [
            {
              id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
              type: 'Scope'
            },
            {
              id: 'b633e1c5-b582-4048-a93e-9f11b44c7e96', // Mail.Send
              type: authMethod === 'client_credentials' ? 'Role' : 'Scope'
            }
          ] : []
        }
      ],
      web: {
        redirectUris: ['http://localhost:3001/auth/callback'],
        implicitGrantSettings: {
          enableIdTokenIssuance: false,
          enableAccessTokenIssuance: false
        }
      },
      publicClient: {
        redirectUris: authMethod === 'device_code' ? ['https://login.microsoftonline.com/common/oauth2/nativeclient'] : []
      }
    };
    
    // Add SMTP OAuth2 permissions if needed
    if (apiMethod === 'smtp_oauth') {
      appPayload.requiredResourceAccess.push({
        resourceAppId: '00000002-0000-0ff1-ce00-000000000000', // Office 365 Exchange Online
        resourceAccess: [
          {
            id: '258f6531-6087-4cc4-bb90-092c5fb3ed3f', // SMTP.Send
            type: authMethod === 'client_credentials' ? 'Role' : 'Scope'
          }
        ]
      });
    }
    
    const createResponse = await axios.post(createAppUrl, appPayload, {
      headers: {
        'Authorization': `Bearer ${flow.adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const app = createResponse.data;
    
    // Create service principal
    const spUrl = 'https://graph.microsoft.com/v1.0/servicePrincipals';
    try {
      await axios.post(spUrl, { appId: app.appId }, {
        headers: {
          'Authorization': `Bearer ${flow.adminToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (spError) {
      console.warn('Failed to create service principal, but app was created');
    }
    
    let clientSecret = null;
    
    // Create client secret if requested
    if (useClientSecret && authMethod === 'client_credentials') {
      const secretUrl = `https://graph.microsoft.com/v1.0/applications/${app.id}/addPassword`;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + clientSecretExpiry);
      
      try {
        const secretResponse = await axios.post(secretUrl, {
          passwordCredential: {
            displayName: 'SMTP Relay Secret',
            endDateTime: expiryDate.toISOString()
          }
        }, {
          headers: {
            'Authorization': `Bearer ${flow.adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        clientSecret = secretResponse.data.secretText;
      } catch (secretError) {
        console.warn('Failed to create client secret');
      }
    }
    
    // Grant admin consent if application permissions are used
    if (authMethod === 'client_credentials') {
      try {
        // This requires the service principal ID which we just created
        const consentUrl = `https://graph.microsoft.com/v1.0/oauth2PermissionGrants`;
        
        // Grant consent for Microsoft Graph
        await axios.post(consentUrl, {
          clientId: app.appId,
          consentType: 'AllPrincipals',
          resourceId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
          scope: 'Mail.Send'
        }, {
          headers: {
            'Authorization': `Bearer ${flow.adminToken}`,
            'Content-Type': 'application/json'
          }
        });
      } catch (err) {
        console.warn('Admin consent may need to be granted manually');
      }
    }
    
    // Save configuration
    const configPath = path.join(process.cwd(), 'config.yml');
    let fullConfig = {};
    
    try {
      const existingContent = await fs.readFile(configPath, 'utf8');
      fullConfig = yaml.parse(existingContent);
    } catch (error) {
      // Config doesn't exist yet
    }
    
    // Update Exchange Online configuration
    fullConfig.exchange_online = {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      auth: {
        method: authMethod,
        tenant_id: flow.tenantId,
        client_id: app.appId
      },
      api_method: apiMethod
    };
    
    if (clientSecret) {
      fullConfig.exchange_online.auth.client_secret = clientSecret;
    }
    
    await fs.writeFile(configPath, yaml.stringify(fullConfig), 'utf8');
    
    // Clean up flow
    activeFlows.delete(flowId);
    
    res.json({
      success: true,
      message: 'Azure AD application created successfully!',
      application: {
        id: app.id,
        appId: app.appId,
        displayName: app.displayName,
        tenantId: flow.tenantId
      },
      clientSecret: clientSecret ? '***HIDDEN*** (saved in config.yml)' : null,
      nextStep: authMethod === 'device_code' ? 
        'You can now authenticate with the Device Code Flow' : 
        'Application is ready to use with Client Credentials'
    });
  } catch (error) {
    console.error('Create app error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;