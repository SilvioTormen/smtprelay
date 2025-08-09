const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireConfigure } = require('../middleware/rbac');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const crypto = require('crypto');
const axios = require('axios');
const { 
    validateTenantId,
    validateMicrosoftUrl
} = require('../../utils/securityValidation');

// Store for active admin flows
const activeAdminFlows = new Map();

/**
 * Initialize Admin Authentication using Microsoft Graph PowerShell
 * This uses Microsoft's official Graph PowerShell app which has the necessary permissions
 */
router.post('/admin/init', authenticate, requireConfigure, async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant ID is required' });
    }
    
    // Microsoft Graph PowerShell Client ID
    // This is a first-party Microsoft application with Application.ReadWrite.All delegated permission
    const graphPowerShellClientId = '14d82eec-204b-4c2f-b7e8-296a70dab67e';
    
    console.log('Starting admin auth flow with Microsoft Graph PowerShell client');
    
    // Validate tenant ID
    const sanitizedTenant = validateTenantId(tenantId);
    
    // Start device code flow for admin authentication
    const deviceCodeUrl = `https://login.microsoftonline.com/${sanitizedTenant}/oauth2/v2.0/devicecode`;
    validateMicrosoftUrl(deviceCodeUrl);
    
    // Request specific permissions needed to create applications
    // Application.ReadWrite.All is required to create new app registrations
    const scope = 'https://graph.microsoft.com/Application.ReadWrite.All https://graph.microsoft.com/Directory.ReadWrite.All https://graph.microsoft.com/User.Read offline_access';
    
    const response = await axios.post(deviceCodeUrl, new URLSearchParams({
      client_id: graphPowerShellClientId,
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
    activeAdminFlows.set(flowId, {
      deviceCode: data.device_code,
      tenantId: sanitizedTenant,
      clientId: graphPowerShellClientId,
      scope,
      expiresAt: Date.now() + (data.expires_in * 1000),
      isAdminFlow: true
    });
    
    console.log(`Admin flow initiated: ${flowId}`);
    
    res.json({
      success: true,
      flowId,
      userCode: data.user_code,
      verificationUrl: data.verification_uri || 'https://microsoft.com/devicelogin',
      expiresIn: data.expires_in,
      interval: data.interval || 5,
      message: 'Please authenticate with your Global Administrator account',
      important: 'You must sign in as a Global Administrator or Application Administrator'
    });
    
  } catch (error) {
    console.error('Admin init error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data 
    });
  }
});

/**
 * Poll for admin authentication completion
 */
router.post('/admin/poll', authenticate, requireConfigure, async (req, res) => {
  try {
    const { flowId } = req.body;
    
    const flow = activeAdminFlows.get(flowId);
    if (!flow) {
      return res.status(400).json({ error: 'Invalid or expired flow' });
    }
    
    if (Date.now() > flow.expiresAt) {
      activeAdminFlows.delete(flowId);
      return res.status(400).json({ error: 'Device code expired' });
    }
    
    // Check if already authenticated
    if (flow.authenticated) {
      return res.json({
        success: true,
        message: 'Already authenticated',
        authenticated: true,
        adminUser: flow.adminUser,
        adminToken: flow.adminToken
      });
    }
    
    // Validate stored tenant ID (should already be sanitized but double-check)
    const sanitizedTenant = validateTenantId(flow.tenantId);
    
    const tokenUrl = `https://login.microsoftonline.com/${sanitizedTenant}/oauth2/v2.0/token`;
    validateMicrosoftUrl(tokenUrl);
    
    try {
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: flow.deviceCode,
        client_id: flow.clientId
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const data = response.data;
      
      // Success! Store the admin token
      flow.adminToken = data.access_token;
      flow.refreshToken = data.refresh_token;
      flow.authenticated = true; // Mark as authenticated to prevent re-polling
      
      console.log('Admin authenticated successfully');
      
      // Get admin user info to verify they have the right permissions
      try {
        const userResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        flow.adminUser = userResponse.data;
        console.log(`Admin user: ${flow.adminUser.userPrincipalName}`);
        
        // Check if user has admin roles
        const roleResponse = await axios.get('https://graph.microsoft.com/v1.0/me/memberOf', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        
        const adminRoles = roleResponse.data.value?.filter(role => 
          role.displayName?.includes('Administrator')
        ) || [];
        
        flow.adminRoles = adminRoles.map(r => r.displayName);
        console.log(`Admin roles: ${flow.adminRoles.join(', ')}`);
        
      } catch (userError) {
        console.log('Could not get user info:', userError.message);
      }
      
      // Store admin auth in session for subsequent requests
      req.session.adminAuth = {
        accessToken: flow.adminToken,
        refreshToken: flow.refreshToken,
        expiresAt: Date.now() + (3600 * 1000), // 1 hour
        userPrincipalName: flow.adminUser?.userPrincipalName,
        displayName: flow.adminUser?.displayName,
        adminRoles: flow.adminRoles
      };
      
      res.json({
        success: true,
        message: 'Admin authentication successful!',
        adminUser: flow.adminUser?.userPrincipalName || 'Administrator',
        adminRoles: flow.adminRoles || [],
        canCreateApps: true,
        authenticated: true
      });
      
    } catch (error) {
      if (error.response?.data?.error === 'authorization_pending') {
        return res.json({ 
          success: false, 
          pending: true,
          message: 'Waiting for admin authorization...' 
        });
      }
      
      console.error('Token error:', error.response?.data);
      throw error;
    }
    
  } catch (error) {
    console.error('Admin poll error:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data 
    });
  }
});

/**
 * Create Azure AD application using admin's delegated permissions
 */
router.post('/admin/create-app', authenticate, requireConfigure, async (req, res) => {
  try {
    const { flowId, appConfig } = req.body;
    
    const flow = activeAdminFlows.get(flowId);
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
    
    console.log(`Creating app: ${displayName} with auth method: ${authMethod} and API method: ${apiMethod}`);
    
    // Create the application using Graph API
    const createAppUrl = 'https://graph.microsoft.com/v1.0/applications';
    
    const appPayload = {
      displayName,
      signInAudience: 'AzureADMyOrg',
      requiredResourceAccess: []
    };
    
    // Configure for Device Code Flow or Client Credentials
    if (authMethod === 'device_code') {
      appPayload.publicClient = {
        redirectUris: [
          'https://login.microsoftonline.com/common/oauth2/nativeclient',
          'http://localhost'
        ]
      };
      appPayload.isFallbackPublicClient = true;
    } else {
      appPayload.web = {
        redirectUris: [],
        implicitGrantSettings: {
          enableAccessTokenIssuance: false,
          enableIdTokenIssuance: false
        }
      };
    }
    
    // Configure permissions based on API method and auth method
    if (apiMethod === 'graph_api') {
      const graphPermissions = {
        resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
        resourceAccess: []
      };
      
      if (authMethod === 'client_credentials') {
        // Application permissions for client credentials
        graphPermissions.resourceAccess.push({
          id: 'b633e1c5-b582-4048-a93e-9f11b44c7e96', // Mail.Send (Application)
          type: 'Role'
        });
      } else {
        // Delegated permissions for device code flow
        graphPermissions.resourceAccess.push({
          id: 'e383f46e-2787-4529-855e-0e479a3ffac0', // Mail.Send (Delegated) - correct ID
          type: 'Scope'
        });
        graphPermissions.resourceAccess.push({
          id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
          type: 'Scope'
        });
      }
      
      appPayload.requiredResourceAccess.push(graphPermissions);
    } else {
      // SMTP OAuth2 - Phase 1: Minimal permissions for app creation
      // Phase 2: offline_access will be requested dynamically during mailbox authentication
      
      // Basic Microsoft Graph permissions for authentication
      const graphPermissions = {
        resourceAppId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
        resourceAccess: []
      };
      
      // User.Read for basic profile information
      graphPermissions.resourceAccess.push({
        id: 'e1fe6dd8-ba31-4d61-89e7-88639da4683d', // User.Read
        type: 'Scope'
      });
      
      // openid for OpenID Connect authentication
      graphPermissions.resourceAccess.push({
        id: '37f7f235-527c-4136-accd-4a02d197296e', // openid
        type: 'Scope'
      });
      
      // SMTP.Send permission - add to Graph permissions
      graphPermissions.resourceAccess.push({
        id: '258f6531-6087-4cc4-bb90-092c5fb3ed3f', // SMTP.Send
        type: authMethod === 'client_credentials' ? 'Role' : 'Scope'
      });
      
      appPayload.requiredResourceAccess.push(graphPermissions);
      
      // Note: offline_access will be requested dynamically in Phase 2 when adding mailboxes
    }
    
    try {
      // Create the application
      console.log('Creating application via Graph API...');
      const createResponse = await axios.post(createAppUrl, appPayload, {
        headers: {
          'Authorization': `Bearer ${flow.adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const app = createResponse.data;
      console.log(`Application created: ${app.appId}`);
      
      // Create service principal
      try {
        console.log('Creating service principal...');
        const spUrl = 'https://graph.microsoft.com/v1.0/servicePrincipals';
        const spResponse = await axios.post(spUrl, { appId: app.appId }, {
          headers: {
            'Authorization': `Bearer ${flow.adminToken}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('Service principal created');
      } catch (spError) {
        console.warn('Service principal creation warning:', spError.message);
      }
      
      let clientSecret = null;
      
      // Create client secret if requested (only for client_credentials)
      if (useClientSecret && authMethod === 'client_credentials') {
        console.log('Creating client secret...');
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
          console.log('Client secret created');
        } catch (secretError) {
          console.error('Client secret creation failed:', secretError.message);
        }
      }
      
      // If using application permissions, we need to grant admin consent
      let consentUrl = null;
      if (authMethod === 'client_credentials') {
        consentUrl = `https://login.microsoftonline.com/${flow.tenantId}/adminconsent?client_id=${app.appId}`;
        console.log('Admin consent required at:', consentUrl);
        
        // Try to grant consent programmatically
        try {
          // Note: This might not work directly, but we try
          const oauth2PermissionGrant = {
            clientId: app.appId,
            consentType: 'AllPrincipals',
            resourceId: '00000003-0000-0000-c000-000000000000', // Microsoft Graph
            scope: 'Mail.Send'
          };
          
          await axios.post('https://graph.microsoft.com/v1.0/oauth2PermissionGrants', oauth2PermissionGrant, {
            headers: {
              'Authorization': `Bearer ${flow.adminToken}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('Admin consent granted programmatically');
        } catch (consentError) {
          console.log('Could not grant consent programmatically, manual consent required');
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
      console.log('Configuration saved to config.yml');
      
      // Clean up flow
      activeAdminFlows.delete(flowId);
      
      res.json({
        success: true,
        message: 'Azure AD application created successfully!',
        application: {
          id: app.id,
          appId: app.appId,
          displayName: app.displayName,
          tenantId: flow.tenantId
        },
        clientSecret: clientSecret ? '***SAVED IN CONFIG***' : null,
        consentUrl: consentUrl,
        nextSteps: authMethod === 'client_credentials' 
          ? 'Please grant admin consent using the URL provided'
          : 'Application is ready for Device Code authentication'
      });
      
    } catch (createError) {
      console.error('App creation error:', createError.response?.data);
      res.status(400).json({
        error: 'Failed to create application',
        details: createError.response?.data?.error || createError.message,
        hint: 'Ensure you are signed in as Global Administrator or Application Administrator'
      });
    }
    
  } catch (error) {
    console.error('Create app error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;