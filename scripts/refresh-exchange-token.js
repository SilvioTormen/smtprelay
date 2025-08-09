#!/usr/bin/env node

const { getInstance } = require('../src/services/tokenManager.js');
const fetch = require('node-fetch');
const yaml = require('yaml');
const fs = require('fs');
const path = require('path');

async function refreshExchangeToken() {
    console.log('🔄 Starting Exchange token refresh...\n');
    
    // Load config
    const configPath = path.join(__dirname, '..', 'config.yml');
    const config = yaml.parse(fs.readFileSync(configPath, 'utf8'));
    
    // Initialize token manager
    const tokenManager = getInstance(console);
    await tokenManager.initialize();
    
    // Get accounts
    const accounts = await tokenManager.listAccounts();
    if (accounts.length === 0) {
        console.error('❌ No accounts found. Please authenticate first.');
        return;
    }
    
    const defaultAccount = accounts.find(a => a.isDefault) || accounts[0];
    console.log(`📧 Account: ${defaultAccount.email || defaultAccount.id}`);
    
    // Get tokens
    const tokens = await tokenManager.getAccountTokens(defaultAccount.id || defaultAccount.email);
    
    if (!tokens || !tokens.refreshToken) {
        console.error('❌ No refresh token found. Re-authentication required.');
        return;
    }
    
    console.log('✅ Refresh token found');
    
    // Check if token is expired
    const now = Date.now();
    const expiresAt = tokens.activeToken?.expiresAt || 0;
    const timeLeft = expiresAt - now;
    
    if (timeLeft > 10 * 60 * 1000) {
        console.log(`ℹ️  Token still valid for ${Math.round(timeLeft / 1000 / 60)} minutes`);
        console.log('   No refresh needed yet.');
        return;
    }
    
    console.log('⏰ Token expired or expiring soon, refreshing...');
    
    // Refresh the token
    const tenantId = config.exchange_online.auth.tenant_id || 'common';
    const clientId = config.exchange_online.auth.client_id;
    const clientSecret = config.exchange_online.auth.client_secret;
    
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    // Use Graph API scope since that's what's configured
    const params = new URLSearchParams({
        client_id: clientId,
        scope: 'https://graph.microsoft.com/Mail.Send offline_access',
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token'
    });
    
    if (clientSecret) {
        params.append('client_secret', clientSecret);
    }
    
    try {
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });
        
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token refresh failed: ${response.statusText} - ${error}`);
        }
        
        const data = await response.json();
        
        // Save the new tokens - MUST include all account data
        const accountTokenData = {
            tenantId: config.exchange_online.auth.tenant_id,
            clientId: config.exchange_online.auth.client_id,
            email: defaultAccount.email,
            displayName: defaultAccount.displayName,
            accessToken: data.access_token,
            refreshToken: data.refresh_token || tokens.refreshToken, // Keep old refresh token if not provided
            expiresAt: Date.now() + (data.expires_in * 1000),
            scope: 'https://graph.microsoft.com/Mail.Send' // or SMTP.Send based on config
        };
        
        await tokenManager.saveAccountTokens(accountTokenData);
        
        console.log('✅ Token refreshed successfully!');
        console.log(`   New token expires at: ${new Date(accountTokenData.expiresAt).toLocaleString()}`);
        
        // Also save to .tokens.json for OAuth2FlowManager compatibility
        const tokensFilePath = path.join(__dirname, '..', '.tokens.json');
        await fs.promises.writeFile(
            tokensFilePath,
            JSON.stringify({
                accessToken: data.access_token,
                expiresOn: accountTokenData.expiresAt,
                refreshToken: accountTokenData.refreshToken,
                authMethod: 'refreshed',
                clientId,
                tenantId
            }, null, 2),
            { mode: 0o600 }
        );
        
        console.log('✅ Token synced to .tokens.json');
        
    } catch (error) {
        console.error('❌ Token refresh failed:', error.message);
        
        if (error.message.includes('invalid_grant')) {
            console.error('\n⚠️  Refresh token is invalid or expired.');
            console.error('   Manual re-authentication required.');
            console.error('   Please login to the dashboard and re-authenticate with Microsoft.');
        }
    }
}

// Run the refresh
refreshExchangeToken().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});