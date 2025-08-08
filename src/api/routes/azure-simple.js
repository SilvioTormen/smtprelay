const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireConfigure } = require('../middleware/rbac');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const crypto = require('crypto');

/**
 * Simple Azure AD app setup - just save the configuration
 * The user needs to create the app manually in Azure Portal
 */
router.post('/save-config', authenticate, requireConfigure, async (req, res) => {
  try {
    const { 
      tenantId, 
      clientId, 
      clientSecret,
      authMethod = 'device_code',
      apiMethod = 'graph_api'
    } = req.body;
    
    if (!tenantId || !clientId) {
      return res.status(400).json({ 
        error: 'Tenant ID and Client ID are required' 
      });
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
        tenant_id: tenantId,
        client_id: clientId
      },
      api_method: apiMethod
    };
    
    if (clientSecret && authMethod === 'client_credentials') {
      fullConfig.exchange_online.auth.client_secret = clientSecret;
    }
    
    await fs.writeFile(configPath, yaml.stringify(fullConfig), 'utf8');
    
    res.json({
      success: true,
      message: 'Azure AD configuration saved successfully!',
      configuration: {
        tenantId,
        clientId,
        authMethod,
        apiMethod,
        hasSecret: !!clientSecret
      },
      nextStep: authMethod === 'device_code' ? 
        'You can now authenticate with the Device Code Flow' : 
        'Application is ready to use with Client Credentials'
    });
  } catch (error) {
    console.error('Save config error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get setup instructions for manual Azure AD app creation
 */
router.get('/instructions', authenticate, requireConfigure, (req, res) => {
  const { authMethod = 'device_code' } = req.query;
  
  const baseInstructions = [
    {
      step: 1,
      title: 'Go to Azure Portal',
      description: 'Navigate to https://portal.azure.com',
      url: 'https://portal.azure.com'
    },
    {
      step: 2,
      title: 'Open App Registrations',
      description: 'Go to Azure Active Directory > App registrations > New registration'
    },
    {
      step: 3,
      title: 'Configure Basic Settings',
      description: 'Name: "SMTP Relay for Exchange Online"',
      details: 'Supported account types: "Accounts in this organizational directory only"'
    }
  ];
  
  const deviceCodeInstructions = [
    ...baseInstructions,
    {
      step: 4,
      title: 'Configure Redirect URI',
      description: 'Platform: "Mobile and desktop applications"',
      details: 'Redirect URI: https://login.microsoftonline.com/common/oauth2/nativeclient'
    },
    {
      step: 5,
      title: 'Configure API Permissions',
      description: 'Add permission > Microsoft Graph > Delegated permissions',
      permissions: ['Mail.Send', 'User.Read', 'offline_access']
    },
    {
      step: 6,
      title: 'Enable Public Client',
      description: 'Go to Authentication > Advanced settings',
      details: 'Enable "Allow public client flows": Yes'
    },
    {
      step: 7,
      title: 'Copy Application ID',
      description: 'Go to Overview and copy the Application (client) ID'
    }
  ];
  
  const clientCredentialsInstructions = [
    ...baseInstructions,
    {
      step: 4,
      title: 'Skip Redirect URI',
      description: 'No redirect URI needed for client credentials flow'
    },
    {
      step: 5,
      title: 'Configure API Permissions',
      description: 'Add permission > Microsoft Graph > Application permissions',
      permissions: ['Mail.Send'],
      important: 'Grant admin consent after adding permissions!'
    },
    {
      step: 6,
      title: 'Create Client Secret',
      description: 'Go to Certificates & secrets > New client secret',
      details: 'Description: "SMTP Relay Secret", Expiry: Choose up to 2 years (Microsoft limit)',
      warning: 'Copy the secret value immediately - it won\'t be shown again!'
    },
    {
      step: 7,
      title: 'Copy Credentials',
      description: 'Copy both Application (client) ID and the Client Secret value'
    }
  ];
  
  const instructions = authMethod === 'client_credentials' ? 
    clientCredentialsInstructions : deviceCodeInstructions;
  
  res.json({
    authMethod,
    instructions,
    portalUrl: 'https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps',
    documentation: 'https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app'
  });
});

module.exports = router;