const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { authenticate } = require('../middleware/auth');
const { requireConfigure } = require('../middleware/rbac');
const { getInstance: getTokenManager } = require('../../services/tokenManager');
const AzureAppRegistrationService = require('../../services/azureAppRegistrationService');

// Initialize token manager and Azure app registration service
let tokenManager;
let azureAppService;

// OAuth2 Configuration Management
// Allow read access for all authenticated users
router.get('/status', authenticate, async (req, res) => {
    try {
        // Initialize token manager if needed
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        // Check if config.yml exists
        const configPath = path.join(process.cwd(), 'config.yml');
        let config = {};
        let hasConfig = false;
        
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            config = yaml.parse(configContent);
            hasConfig = true;
        } catch (error) {
            // Config doesn't exist yet
        }

        // Get accounts from token manager
        const accounts = await tokenManager.listAccounts();
        const defaultTokens = await tokenManager.getDefaultTokens();
        const stats = await tokenManager.getStatistics();
        
        // Check if we have valid tokens
        const hasTokens = accounts.length > 0 && accounts.some(a => a.hasValidToken);
        const defaultAccount = accounts.find(a => a.isDefault);
        
        // Build applications array from config
        const applications = [];
        if (config.exchange_online?.auth?.client_id) {
            applications.push({
                displayName: config.exchange_online?.app_name || 'SMTP Relay for Exchange Online',
                appId: config.exchange_online.auth.client_id,
                tenantId: config.exchange_online.auth.tenant_id,
                authMethod: config.exchange_online.auth.method,
                status: hasTokens ? 'active' : 'inactive'
            });
        }

        res.json({
            hasConfig,
            hasTokens,
            accounts,
            defaultAccount,
            statistics: stats,
            exchangeConfig: config.exchange_online || null,
            authMethod: config.exchange_online?.auth?.method || null,
            apiMethod: config.exchange_online?.api_method || null,
            isConfigured: hasConfig && hasTokens,
            applications, // Add applications array
            tenantId: config.exchange_online?.auth?.tenant_id,
            clientId: config.exchange_online?.auth?.client_id
        });
    } catch (error) {
        console.error('Error checking Exchange status:', error);
        res.status(500).json({ error: 'Failed to check Exchange configuration status' });
    }
});

// Get current Exchange configuration
router.get('/config', authenticate, requireConfigure, async (req, res) => {
    try {
        const configPath = path.join(process.cwd(), 'config.yml');
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = yaml.parse(configContent);
        
        // Remove sensitive data
        if (config.exchange_online?.auth?.client_secret) {
            config.exchange_online.auth.client_secret = '***HIDDEN***';
        }
        
        res.json({
            exchange_online: config.exchange_online || {},
            ip_whitelist: config.ip_whitelist || {},
            legacy_auth: config.legacy_auth || {}
        });
    } catch (error) {
        res.json({
            exchange_online: {},
            ip_whitelist: { no_auth_required: [] },
            legacy_auth: { static_users: [] }
        });
    }
});

// Save Exchange configuration
router.post('/config', authenticate, requireConfigure, async (req, res) => {
    try {
        const { exchange_online, ip_whitelist, legacy_auth } = req.body;
        
        const configPath = path.join(process.cwd(), 'config.yml');
        let config = {};
        
        // Load existing config
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            config = yaml.parse(configContent);
        } catch (error) {
            // Config doesn't exist, create new
        }
        
        // Update config
        if (exchange_online) {
            config.exchange_online = {
                ...config.exchange_online,
                ...exchange_online
            };
        }
        
        if (ip_whitelist) {
            config.ip_whitelist = ip_whitelist;
        }
        
        if (legacy_auth) {
            config.legacy_auth = legacy_auth;
        }
        
        // Save config
        await fs.writeFile(configPath, yaml.stringify(config), 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Configuration saved successfully',
            requiresRestart: true 
        });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
});

// Initiate OAuth2 authentication
router.post('/oauth/init', authenticate, requireConfigure, async (req, res) => {
    try {
        const { authMethod, tenantId, clientId, clientSecret, apiMethod } = req.body;
        
        // Load existing config first
        const configPath = path.join(process.cwd(), 'config.yml');
        let fullConfig = {};
        try {
            const existingContent = await fs.readFile(configPath, 'utf8');
            fullConfig = yaml.parse(existingContent);
        } catch (error) {
            // Config doesn't exist yet, start fresh
        }
        
        // Update only Exchange Online section
        fullConfig.exchange_online = {
            host: 'smtp.office365.com',
            port: 587,
            secure: false,
            auth: {
                method: authMethod,
                tenant_id: tenantId,
                client_id: clientId
            },
            api_method: apiMethod || 'graph_api'
        };
        
        if (authMethod === 'client_credentials' && clientSecret) {
            fullConfig.exchange_online.auth.client_secret = clientSecret;
        }
        
        // Save complete config
        await fs.writeFile(configPath, yaml.stringify(fullConfig), 'utf8');
        
        if (authMethod === 'device_code') {
            // Start device code flow
            const deviceCodeUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/devicecode`;
            const scope = apiMethod === 'graph_api' 
                ? 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
                : 'https://outlook.office365.com/SMTP.Send offline_access';
            
            const response = await fetch(deviceCodeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    scope: scope
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error_description || data.error);
            }
            
            res.json({
                success: true,
                method: 'device_code',
                userCode: data.user_code,
                verificationUrl: data.verification_uri,
                deviceCode: data.device_code,
                expiresIn: data.expires_in,
                interval: data.interval,
                message: data.message
            });
        } else if (authMethod === 'client_credentials') {
            // Test client credentials
            const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            const scope = 'https://graph.microsoft.com/.default';
            
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    scope: scope,
                    grant_type: 'client_credentials'
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error_description || data.error);
            }
            
            // Save tokens using TokenManager
            if (!tokenManager) {
                tokenManager = getTokenManager(console);
            }
            
            await tokenManager.saveAccountTokens({
                tenantId,
                clientId,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
                scope: scope,
                tokenType: data.token_type || 'Bearer'
            });
            
            res.json({
                success: true,
                method: 'client_credentials',
                message: 'Authentication successful!'
            });
        } else {
            res.json({
                success: true,
                method: authMethod,
                message: 'Configuration saved. Manual authentication required.'
            });
        }
    } catch (error) {
        console.error('OAuth init error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Poll for device code completion
router.post('/oauth/poll', authenticate, requireConfigure, async (req, res) => {
    try {
        const { deviceCode, tenantId, clientId } = req.body;
        
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                device_code: deviceCode,
                client_id: clientId
            })
        });
        
        const data = await response.json();
        
        if (data.error === 'authorization_pending') {
            res.json({ 
                success: false, 
                pending: true,
                message: 'Waiting for user authorization...' 
            });
        } else if (data.error) {
            throw new Error(data.error_description || data.error);
        } else {
            // Save tokens using TokenManager
            if (!tokenManager) {
                tokenManager = getTokenManager(console);
            }
            
            // Get user info if possible
            let userInfo = { email: null, displayName: null };
            try {
                const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: { 'Authorization': `Bearer ${data.access_token}` }
                });
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    userInfo.email = userData.userPrincipalName || userData.mail;
                    userInfo.displayName = userData.displayName;
                }
            } catch (e) {
                // Continue without user info
            }
            
            // Get API method from config
            const configPath = path.join(process.cwd(), 'config.yml');
            let apiMethod = 'graph_api';
            try {
                const configContent = await fs.readFile(configPath, 'utf8');
                const config = yaml.parse(configContent);
                apiMethod = config.exchange_online?.api_method || 'graph_api';
            } catch (e) {
                // Use default
            }
            
            await tokenManager.saveAccountTokens({
                tenantId,
                clientId,
                email: userInfo.email,
                displayName: userInfo.displayName,
                accessToken: data.access_token,
                refreshToken: data.refresh_token,
                expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
                scope: apiMethod === 'graph_api' 
                    ? 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
                    : 'https://outlook.office365.com/SMTP.Send offline_access',
                tokenType: data.token_type || 'Bearer'
            });
            
            res.json({
                success: true,
                message: 'Authentication successful!'
            });
        }
    } catch (error) {
        console.error('OAuth poll error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test Exchange connection
router.post('/test', authenticate, requireConfigure, async (req, res) => {
    try {
        const { accountId } = req.body;
        
        // Initialize token manager if needed
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        // Get tokens for specified account or default
        const tokenData = accountId ? 
            await tokenManager.getAccountTokens(accountId) :
            await tokenManager.getDefaultTokens();
        
        if (!tokenData || !tokenData.accessToken) {
            throw new Error('No valid access token found');
        }
        
        // Check if token needs refresh
        if (tokenData.needsRefresh && tokenData.refreshToken) {
            // TODO: Implement token refresh
            throw new Error('Token expired and needs refresh');
        }
        
        // Test Graph API
        const response = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: {
                'Authorization': `Bearer ${tokenData.accessToken}`
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            res.json({
                success: true,
                message: 'Connection successful!',
                user: userData.userPrincipalName || userData.mail,
                account: tokenData.account
            });
        } else {
            throw new Error('Failed to connect to Microsoft Graph');
        }
    } catch (error) {
        console.error('Test connection error:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get all accounts
router.get('/accounts', authenticate, requireConfigure, async (req, res) => {
    try {
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        const accounts = await tokenManager.listAccounts();
        const stats = await tokenManager.getStatistics();
        
        res.json({ accounts, statistics: stats });
    } catch (error) {
        console.error('Error getting accounts:', error);
        res.status(500).json({ error: 'Failed to get accounts' });
    }
});

// Set default account
router.post('/accounts/:accountId/set-default', authenticate, requireConfigure, async (req, res) => {
    try {
        const { accountId } = req.params;
        
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        await tokenManager.setDefaultAccount(accountId);
        
        res.json({ success: true, message: 'Default account updated' });
    } catch (error) {
        console.error('Error setting default account:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove account
router.delete('/accounts/:accountId', authenticate, requireConfigure, async (req, res) => {
    try {
        const { accountId } = req.params;
        
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        await tokenManager.removeAccount(accountId);
        
        res.json({ success: true, message: 'Account removed successfully' });
    } catch (error) {
        console.error('Error removing account:', error);
        res.status(500).json({ error: error.message });
    }
});

// Refresh account tokens
router.post('/accounts/:accountId/refresh', authenticate, requireConfigure, async (req, res) => {
    try {
        const { accountId } = req.params;
        
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        // Get current tokens
        const tokenData = await tokenManager.getAccountTokens(accountId);
        if (!tokenData || !tokenData.refreshToken) {
            throw new Error('No refresh token available');
        }
        
        // Get config for tenant and client info
        const configPath = path.join(process.cwd(), 'config.yml');
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = yaml.parse(configContent);
        
        const tenantId = tokenData.account.tenantId;
        const clientId = tokenData.account.clientId;
        
        // Refresh tokens
        const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokenData.refreshToken,
                client_id: clientId,
                scope: tokenData.scope || 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access'
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error_description || data.error);
        }
        
        // Update tokens
        await tokenManager.refreshAccountTokens(accountId, {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || tokenData.refreshToken,
            expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
            scope: tokenData.scope,
            tokenType: data.token_type || 'Bearer'
        });
        
        res.json({ success: true, message: 'Tokens refreshed successfully' });
    } catch (error) {
        console.error('Error refreshing tokens:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear all tokens (legacy endpoint for compatibility)
router.delete('/tokens', authenticate, requireConfigure, async (req, res) => {
    try {
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        const accounts = await tokenManager.listAccounts();
        for (const account of accounts) {
            await tokenManager.removeAccount(account.id);
        }
        
        res.json({ success: true, message: 'All tokens cleared successfully' });
    } catch (error) {
        res.json({ success: true, message: 'No tokens to clear' });
    }
});

// Azure AD Automatic App Registration Endpoints

// Initiate admin authentication for automatic setup
router.post('/azure/admin-auth', authenticate, requireConfigure, async (req, res) => {
    try {
        if (!azureAppService) {
            azureAppService = new AzureAppRegistrationService(console);
        }
        
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('Host');
        const redirectUri = `${protocol}://${host}/api/exchange-config/azure/admin-callback`;
        
        const result = await azureAppService.initiateAdminAuth(redirectUri);
        
        if (result.success) {
            // Store state in session for security
            req.session.azureState = result.state;
            req.session.azureNonce = result.nonce;
            
            res.json({
                success: true,
                authUrl: result.authUrl
            });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Admin auth initiation error:', error);
        res.status(500).json({ error: 'Failed to initiate admin authentication' });
    }
});

// Handle admin authentication callback
router.post('/azure/admin-callback', authenticate, requireConfigure, async (req, res) => {
    try {
        const { code, state } = req.body;
        
        if (!azureAppService) {
            azureAppService = new AzureAppRegistrationService(console);
        }
        
        // Verify state matches what we stored
        if (!req.session.azureState || req.session.azureState !== state) {
            return res.status(400).json({ error: 'Invalid state parameter' });
        }
        
        const protocol = req.secure ? 'https' : 'http';
        const host = req.get('Host');
        const redirectUri = `${protocol}://${host}/api/exchange-config/azure/admin-callback`;
        
        const result = await azureAppService.handleAdminCallback(code, state, redirectUri);
        
        if (result.success) {
            // Store admin auth in session
            req.session.adminAuth = result.adminAuth;
            
            res.json({
                success: true,
                adminAuth: {
                    displayName: result.adminAuth.displayName,
                    userPrincipalName: result.adminAuth.userPrincipalName,
                    tenantId: result.adminAuth.tenantId
                }
            });
        } else {
            res.status(400).json({ error: result.error });
        }
    } catch (error) {
        console.error('Admin callback error:', error);
        res.status(500).json({ error: 'Authentication callback failed' });
    }
});

// Create Azure AD application automatically
router.post('/azure/create-app', authenticate, requireConfigure, async (req, res) => {
    try {
        const { appConfig, adminToken } = req.body;
        
        if (!req.session.adminAuth && !adminToken) {
            return res.status(401).json({ error: 'Admin authentication required' });
        }
        
        if (!azureAppService) {
            azureAppService = new AzureAppRegistrationService(console);
        }
        
        const token = adminToken || req.session.adminAuth?.accessToken;
        
        // Set up Server-Sent Events for progress updates
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        const sendProgress = (step, status, message = '') => {
            res.write(`data: ${JSON.stringify({ type: 'progress', step, status, message })}\n\n`);
        };
        
        try {
            const result = await azureAppService.createApplication(appConfig, token, (step, status, message) => {
                sendProgress(step, status, message);
            });
            
            if (result.success) {
                res.write(`data: ${JSON.stringify({ type: 'complete', appRegistration: result.appRegistration })}\n\n`);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'error', error: result.error })}\n\n`);
            }
        } catch (error) {
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        }
        
        res.end();
        
    } catch (error) {
        console.error('App creation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to create application' });
        }
    }
});

// Setup service account
router.post('/azure/setup-service', authenticate, requireConfigure, async (req, res) => {
    try {
        const { appId, tenantId, serviceAccount, adminToken } = req.body;
        
        if (!req.session.adminAuth && !adminToken) {
            return res.status(401).json({ error: 'Admin authentication required' });
        }
        
        if (!azureAppService) {
            azureAppService = new AzureAppRegistrationService(console);
        }
        
        const token = adminToken || req.session.adminAuth?.accessToken;
        
        const result = await azureAppService.setupServiceAccount(appId, tenantId, serviceAccount, token);
        
        res.json(result);
        
    } catch (error) {
        console.error('Service account setup error:', error);
        res.status(500).json({ error: 'Failed to setup service account' });
    }
});

// Test automatic configuration
router.post('/azure/test', authenticate, requireConfigure, async (req, res) => {
    try {
        const { appId, tenantId, serviceAccount } = req.body;
        
        if (!azureAppService) {
            azureAppService = new AzureAppRegistrationService(console);
        }
        
        const result = await azureAppService.testConfiguration(appId, tenantId, serviceAccount);
        
        res.json(result);
        
    } catch (error) {
        console.error('Configuration test error:', error);
        res.status(500).json({ error: 'Configuration test failed' });
    }
});

// Get automatic setup status
router.get('/azure/setup-status', authenticate, requireConfigure, async (req, res) => {
    try {
        const hasAdminAuth = !!req.session.adminAuth;
        const adminAuthExpired = req.session.adminAuth ? 
            new Date(req.session.adminAuth.expiresAt) < new Date() : true;
        
        res.json({
            hasAdminAuth: hasAdminAuth && !adminAuthExpired,
            adminUser: req.session.adminAuth ? {
                displayName: req.session.adminAuth.displayName,
                userPrincipalName: req.session.adminAuth.userPrincipalName
            } : null,
            canAutoSetup: hasAdminAuth && !adminAuthExpired
        });
        
    } catch (error) {
        console.error('Setup status error:', error);
        res.status(500).json({ error: 'Failed to get setup status' });
    }
});

// Clear admin authentication
router.post('/azure/clear-admin', authenticate, requireConfigure, async (req, res) => {
    try {
        delete req.session.adminAuth;
        delete req.session.azureState;
        delete req.session.azureNonce;
        
        res.json({ success: true, message: 'Admin authentication cleared' });
        
    } catch (error) {
        console.error('Clear admin error:', error);
        res.status(500).json({ error: 'Failed to clear admin authentication' });
    }
});

// Get token status - detailed information about current tokens
router.get('/token-status', authenticate, requireConfigure, async (req, res) => {
    try {
        // Initialize token manager if needed
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        const accounts = await tokenManager.listAccounts();
        const defaultAccount = accounts.find(a => a.isDefault);
        
        if (!defaultAccount) {
            return res.json({
                accessToken: false,
                refreshToken: false,
                error: 'No tokens found'
            });
        }
        
        const tokens = await tokenManager.getAccountTokens(defaultAccount.id || defaultAccount.email);
        const now = new Date();
        
        console.log('Token status - tokens:', tokens);
        console.log('Token status - expiresAt:', tokens?.expiresAt);
        
        res.json({
            accessToken: !!tokens?.accessToken,
            refreshToken: !!tokens?.refreshToken,
            accessTokenExpiry: tokens?.expiresAt,
            refreshTokenExpiry: tokens?.refreshTokenExpiresAt || 
                (tokens?.expiresAt ? new Date(new Date(tokens.expiresAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString() : null),
            lastRefresh: tokens?.acquiredAt || tokens?.createdAt,
            tokenType: tokens?.tokenType,
            scope: tokens?.scope,
            isValid: tokens?.expiresAt ? new Date(tokens.expiresAt) > now : false
        });
    } catch (error) {
        console.error('Token status error:', error);
        res.status(500).json({ 
            error: 'Failed to get token status',
            details: error.message 
        });
    }
});

// Get configured mailboxes
router.get('/mailboxes', authenticate, requireConfigure, async (req, res) => {
    try {
        const configPath = path.join(process.cwd(), 'config.yml');
        let mailboxes = [];
        
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = yaml.parse(configContent);
            const exchangeConfig = config.exchange_online || {};
            
            // Get primary mailbox
            if (exchangeConfig.auth?.send_as || exchangeConfig.default_from) {
                mailboxes.push({
                    email: exchangeConfig.auth?.send_as || exchangeConfig.default_from,
                    type: 'Primary',
                    permissions: ['Send As', 'Send on Behalf'],
                    status: 'active'
                });
            }
            
            // Get additional mailboxes if configured
            if (exchangeConfig.mailboxes && Array.isArray(exchangeConfig.mailboxes)) {
                exchangeConfig.mailboxes.forEach(mailbox => {
                    mailboxes.push({
                        email: mailbox.email || mailbox,
                        type: mailbox.type || 'Shared',
                        permissions: mailbox.permissions || ['Send As'],
                        status: mailbox.status || 'active'
                    });
                });
            }
            
            // Get authorized senders
            if (exchangeConfig.authorized_senders && Array.isArray(exchangeConfig.authorized_senders)) {
                exchangeConfig.authorized_senders.forEach(sender => {
                    if (!mailboxes.find(m => m.email === sender)) {
                        mailboxes.push({
                            email: sender,
                            type: 'Authorized Sender',
                            permissions: ['Send As'],
                            status: 'active'
                        });
                    }
                });
            }
            
            // Also check token manager for accounts
            if (!tokenManager) {
                tokenManager = getTokenManager(console);
            }
            const accounts = await tokenManager.listAccounts();
            
            accounts.forEach(account => {
                // Skip accounts without a valid email
                if (account.email && account.email !== 'undefined' && !mailboxes.find(m => m.email === account.email)) {
                    mailboxes.push({
                        email: account.email,
                        type: account.isDefault ? 'Default Account' : 'Token Account',
                        permissions: ['Send As'],
                        status: account.hasValidToken ? 'active' : 'expired'
                    });
                }
            });
            
        } catch (err) {
            console.log('Error reading mailboxes:', err.message);
        }
        
        res.json(mailboxes);
    } catch (error) {
        console.error('Mailboxes fetch error:', error);
        res.status(500).json({ 
            error: 'Failed to get mailboxes',
            details: error.message 
        });
    }
});

// Delete a mailbox and all associated tokens
router.delete('/mailboxes/:email', authenticate, requireConfigure, async (req, res) => {
    try {
        const { email } = req.params;
        const decodedEmail = decodeURIComponent(email);
        
        console.log(`Deleting mailbox: ${decodedEmail}`);
        
        // Initialize token manager if needed
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        // Find and delete the account from token manager
        const accounts = await tokenManager.listAccounts();
        const account = accounts.find(a => a.email === decodedEmail);
        
        if (account) {
            // Delete the account and all its tokens
            try {
                // Use the account ID, not the email
                await tokenManager.removeAccount(account.id);
                console.log(`Successfully deleted account tokens for: ${decodedEmail} (ID: ${account.id})`);
            } catch (tokenError) {
                console.error(`Error deleting tokens for ${decodedEmail}:`, tokenError);
                // Continue even if token deletion fails
            }
        } else {
            console.log(`No token account found for email: ${decodedEmail}`);
        }
        
        // Update config.yml to remove mailbox from authorized senders and mailboxes lists
        const configPath = path.join(process.cwd(), 'config.yml');
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = yaml.parse(configContent);
            
            if (config.exchange_online) {
                // Remove from authorized_senders
                if (config.exchange_online.authorized_senders) {
                    config.exchange_online.authorized_senders = 
                        config.exchange_online.authorized_senders.filter(s => s !== decodedEmail);
                    
                    // Remove the array if empty
                    if (config.exchange_online.authorized_senders.length === 0) {
                        delete config.exchange_online.authorized_senders;
                    }
                }
                
                // Remove from mailboxes array
                if (config.exchange_online.mailboxes) {
                    config.exchange_online.mailboxes = 
                        config.exchange_online.mailboxes.filter(m => {
                            if (typeof m === 'string') {
                                return m !== decodedEmail;
                            }
                            return m.email !== decodedEmail;
                        });
                    
                    // Remove the array if empty
                    if (config.exchange_online.mailboxes.length === 0) {
                        delete config.exchange_online.mailboxes;
                    }
                }
                
                // If this was the default send_as account, clear it
                if (config.exchange_online.auth?.send_as === decodedEmail) {
                    delete config.exchange_online.auth.send_as;
                }
                
                if (config.exchange_online.default_from === decodedEmail) {
                    delete config.exchange_online.default_from;
                }
                
                // Write updated config
                await fs.writeFile(configPath, yaml.stringify(config), 'utf8');
                console.log(`Updated config.yml to remove mailbox: ${decodedEmail}`);
            }
        } catch (configError) {
            console.error('Error updating config:', configError);
            // Continue even if config update fails
        }
        
        res.json({ 
            success: true, 
            message: `Mailbox ${decodedEmail} and all associated tokens have been deleted`
        });
        
    } catch (error) {
        console.error('Mailbox deletion error:', error);
        res.status(500).json({ 
            error: 'Failed to delete mailbox',
            details: error.message 
        });
    }
});

// Test Exchange connection
router.post('/test', authenticate, requireConfigure, async (req, res) => {
    try {
        const { accountId } = req.body;
        
        // Initialize token manager if needed
        if (!tokenManager) {
            tokenManager = getTokenManager(console);
        }
        
        // Check if we have valid tokens
        const accounts = await tokenManager.listAccounts();
        const account = accountId ? 
            accounts.find(a => a.email === accountId) : 
            accounts.find(a => a.isDefault);
        
        if (!account) {
            return res.json({
                success: false,
                error: 'No authentication tokens found. Please complete setup first.'
            });
        }
        
        if (!account.hasValidToken) {
            return res.json({
                success: false,
                error: 'Authentication token expired. Please re-authenticate.'
            });
        }
        
        // Test the actual connection by trying to get a token
        try {
            const tokens = await tokenManager.getAccountTokens(account.id || account.email);
            if (tokens?.access_token) {
                res.json({
                    success: true,
                    message: 'Exchange Online connection is working',
                    account: account.email,
                    tokenValid: true,
                    apiMethod: 'Microsoft Graph API'
                });
            } else {
                res.json({
                    success: false,
                    error: 'Could not retrieve access token'
                });
            }
        } catch (tokenError) {
            res.json({
                success: false,
                error: 'Token validation failed',
                details: tokenError.message
            });
        }
    } catch (error) {
        console.error('Connection test error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Connection test failed',
            details: error.message 
        });
    }
});

// Delete Azure AD Application configuration (Smart Delete)
// Note: Using only authenticate middleware, permission check done inside
router.post('/delete-app', authenticate, async (req, res) => {
    try {
        const { appId, tenantId, displayName, deleteFromAzure } = req.body;
        
        if (!appId) {
            return res.status(400).json({ error: 'Application ID is required' });
        }
        
        const configPath = path.join(process.cwd(), 'config.yml');
        const tokensPath = path.join(process.cwd(), '.tokens.json');
        
        // Read current config
        let config = {};
        try {
            const configContent = await fs.readFile(configPath, 'utf8');
            config = yaml.parse(configContent);
        } catch (err) {
            return res.status(404).json({ error: 'Configuration file not found' });
        }
        
        // Check if this is the configured app
        if (config.exchange_online?.auth?.client_id === appId) {
            // If deleting from Azure AD, we need admin authentication
            if (deleteFromAzure) {
                // Initialize Azure service if needed
                if (!azureAppService) {
                    azureAppService = new AzureAppRegistrationService(console);
                }
                
                // Check if we have admin auth in session
                const hasAdminAuth = req.session?.adminAuth?.accessToken && 
                                    req.session?.adminAuth?.expiresAt > Date.now();
                
                if (!hasAdminAuth) {
                    // Store the delete request in session for after auth
                    req.session.pendingDelete = {
                        appId,
                        displayName,
                        tenantId,
                        timestamp: Date.now()
                    };
                    
                    // Return a flag that tells frontend to initiate admin auth
                    return res.status(401).json({ 
                        requiresAdminAuth: true,
                        message: 'Administrator authentication required to delete Azure AD application',
                        action: 'initiate_admin_auth',
                        tenantId: config.exchange_online?.auth?.tenant_id || tenantId
                    });
                }
                
                // Try to delete from Azure AD
                try {
                    console.log(`Attempting to delete Azure AD app: ${appId} (${displayName})`);
                    
                    // First, get the object ID of the application
                    const graphUrl = `https://graph.microsoft.com/v1.0/applications?$filter=appId eq '${appId}'`;
                    const searchResponse = await fetch(graphUrl, {
                        headers: {
                            'Authorization': `Bearer ${req.session.adminAuth.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (!searchResponse.ok) {
                        throw new Error(`Failed to find application: ${searchResponse.statusText}`);
                    }
                    
                    const searchData = await searchResponse.json();
                    let objectId = null;
                    
                    if (!searchData.value || searchData.value.length === 0) {
                        console.log(`Application ${appId} not found in Azure AD - may have been already deleted`);
                        // Continue with local deletion even if Azure AD app doesn't exist
                    } else {
                        objectId = searchData.value[0].id;
                        
                        // Delete the application
                        const deleteUrl = `https://graph.microsoft.com/v1.0/applications/${objectId}`;
                        const deleteResponse = await fetch(deleteUrl, {
                            method: 'DELETE',
                            headers: {
                                'Authorization': `Bearer ${req.session.adminAuth.accessToken}`
                            }
                        });
                        
                        if (!deleteResponse.ok && deleteResponse.status !== 204) {
                            throw new Error(`Failed to delete application: ${deleteResponse.statusText}`);
                        }
                        
                        console.log(`Successfully deleted Azure AD app: ${appId} (${displayName})`);
                    }
                    
                    // Audit log
                    const auditLog = {
                        timestamp: new Date().toISOString(),
                        action: 'DELETE_AZURE_APP',
                        user: req.session.user?.username || 'unknown',
                        appId,
                        displayName,
                        objectId: objectId || 'not_found',
                        tenantId,
                        result: 'success'
                    };
                    
                    // Write audit log
                    const auditPath = path.join(process.cwd(), 'logs', 'azure-delete-audit.log');
                    await fs.appendFile(auditPath, JSON.stringify(auditLog) + '\n').catch(() => {});
                    
                } catch (azureError) {
                    console.error('Failed to delete from Azure AD:', azureError);
                    
                    // Log the failed attempt
                    const auditLog = {
                        timestamp: new Date().toISOString(),
                        action: 'DELETE_AZURE_APP_FAILED',
                        user: req.session.user?.username || 'unknown',
                        appId,
                        displayName,
                        error: azureError.message,
                        result: 'failed'
                    };
                    
                    const auditPath = path.join(process.cwd(), 'logs', 'azure-delete-audit.log');
                    await fs.appendFile(auditPath, JSON.stringify(auditLog) + '\n').catch(() => {});
                    
                    return res.status(500).json({ 
                        error: 'Failed to delete application from Azure AD',
                        details: azureError.message
                    });
                }
            }
            
            // Clear the Exchange Online configuration
            delete config.exchange_online;
            
            // Remove tokens if they exist
            try {
                await fs.unlink(tokensPath);
                console.log('Deleted tokens file');
            } catch (err) {
                // Tokens file might not exist, that's okay
            }
            
            // Clear token manager cache if available
            if (tokenManager) {
                try {
                    const accounts = await tokenManager.listAccounts();
                    for (const account of accounts) {
                        await tokenManager.removeAccount(account.id);
                    }
                } catch (err) {
                    console.log('Could not clear token manager:', err.message);
                }
            }
            
            // Save updated config
            const yamlStr = yaml.stringify(config);
            await fs.writeFile(configPath, yamlStr, 'utf8');
            
            // Clear session data related to Azure
            if (req.session) {
                delete req.session.adminAuth;
                delete req.session.azureState;
                delete req.session.azureNonce;
            }
            
            // Audit log for config deletion
            const auditLog = {
                timestamp: new Date().toISOString(),
                action: deleteFromAzure ? 'DELETE_CONFIG_AND_AZURE' : 'DELETE_CONFIG_ONLY',
                user: req.session?.user?.username || 'unknown',
                appId,
                displayName,
                tenantId,
                result: 'success'
            };
            
            const auditPath = path.join(process.cwd(), 'logs', 'config-delete-audit.log');
            await fs.appendFile(auditPath, JSON.stringify(auditLog) + '\n').catch(() => {});
            
            res.json({ 
                success: true, 
                message: deleteFromAzure 
                    ? 'Application and Azure AD registration deleted successfully'
                    : 'Application configuration deleted successfully',
                deletedApp: {
                    appId,
                    displayName,
                    tenantId
                },
                deletedFromAzure: deleteFromAzure
            });
        } else {
            res.status(404).json({ 
                error: 'Application not found in configuration',
                requestedApp: appId,
                configuredApp: config.exchange_online?.auth?.client_id
            });
        }
    } catch (error) {
        console.error('Delete app error:', error);
        res.status(500).json({ 
            error: 'Failed to delete application configuration',
            details: error.message 
        });
    }
});

module.exports = router;