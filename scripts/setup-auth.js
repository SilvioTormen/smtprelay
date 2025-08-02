#!/usr/bin/env node

/**
 * Interactive OAuth2 Setup Wizard
 * Helps administrators configure authentication for SMTP Relay
 */

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('yaml');
const { OAuth2FlowManager } = require('../src/auth/oauth2-flows');
const winston = require('winston');

// Simple logger for setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

class SetupWizard {
  constructor() {
    this.config = null;
    this.configPath = path.join(__dirname, '../config.yml');
  }

  async run() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 SMTP RELAY OAUTH2 SETUP WIZARD');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // Load existing config
      await this.loadConfig();

      // Choose authentication method
      const authMethod = await this.chooseAuthMethod();

      // Get Azure AD details
      await this.getAzureDetails();

      // Configure based on chosen method
      switch (authMethod) {
        case 'device_code':
          await this.setupDeviceCode();
          break;
        case 'client_credentials':
          await this.setupClientCredentials();
          break;
        case 'authorization_code':
          await this.setupAuthorizationCode();
          break;
      }

      // Save configuration
      await this.saveConfig();

      console.log('\n✅ Setup completed successfully!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
    } finally {
      rl.close();
    }
  }

  async loadConfig() {
    try {
      const configContent = await fs.readFile(this.configPath, 'utf8');
      this.config = yaml.parse(configContent);
      console.log('✓ Loaded existing configuration\n');
    } catch (error) {
      console.log('ℹ️  No existing configuration found, creating new one\n');
      this.config = {
        exchange_online: {
          auth: {}
        }
      };
    }
  }

  async chooseAuthMethod() {
    console.log('📋 Choose Authentication Method:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('1. Device Code Flow (Recommended for server setup)');
    console.log('   - Perfect for headless servers');
    console.log('   - Authenticate using code on another device');
    console.log('   - User delegated permissions\n');
    
    console.log('2. Client Credentials Flow (For automated services)');
    console.log('   - No user interaction required');
    console.log('   - Application permissions');
    console.log('   - Requires client secret\n');
    
    console.log('3. Authorization Code Flow (For web dashboard)');
    console.log('   - Interactive browser-based login');
    console.log('   - User delegated permissions');
    console.log('   - Best for web applications\n');

    const choice = await question('Enter your choice (1-3): ');
    
    const methods = {
      '1': 'device_code',
      '2': 'client_credentials',
      '3': 'authorization_code'
    };

    const method = methods[choice];
    if (!method) {
      throw new Error('Invalid choice');
    }

    this.config.exchange_online.auth.method = method;
    console.log(`\n✓ Selected: ${method}\n`);
    return method;
  }

  async getAzureDetails() {
    console.log('🔐 Azure AD Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Tenant ID
    const currentTenant = this.config.exchange_online.auth.tenant_id;
    const tenantPrompt = currentTenant 
      ? `Tenant ID [${currentTenant}]: `
      : 'Tenant ID (or "common" for multi-tenant): ';
    
    const tenantId = await question(tenantPrompt) || currentTenant || 'common';
    this.config.exchange_online.auth.tenant_id = tenantId;

    // Client ID
    const currentClient = this.config.exchange_online.auth.client_id;
    const clientPrompt = currentClient
      ? `Client ID (Application ID) [${currentClient}]: `
      : 'Client ID (Application ID): ';
    
    const clientId = await question(clientPrompt) || currentClient;
    if (!clientId) {
      throw new Error('Client ID is required');
    }
    this.config.exchange_online.auth.client_id = clientId;

    console.log('\n✓ Azure AD details configured\n');
  }

  async setupDeviceCode() {
    console.log('📱 Device Code Flow Setup:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('Prerequisites:');
    console.log('1. Azure AD App with "SMTP.Send" API permission');
    console.log('2. Public client flow enabled in Azure AD');
    console.log('3. Admin consent (if required by tenant)\n');

    const proceed = await question('Ready to authenticate? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('Setup cancelled');
      return;
    }

    // Initialize OAuth2 manager
    const oauth2Manager = new OAuth2FlowManager(this.config.exchange_online, logger);
    
    try {
      console.log('\nInitializing Device Code authentication...\n');
      const result = await oauth2Manager.initializeDeviceCodeFlow();
      
      if (result.success) {
        console.log('\n✅ Authentication successful!');
        console.log('Tokens have been saved and will be automatically refreshed.');
        
        // Optional: Set send-as email
        const sendAs = await question('\nDefault sender email address (optional): ');
        if (sendAs) {
          this.config.exchange_online.auth.send_as = sendAs;
        }
      }
    } catch (error) {
      console.error('\n❌ Authentication failed:', error.message);
      throw error;
    }
  }

  async setupClientCredentials() {
    console.log('🔑 Client Credentials Flow Setup:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Prerequisites:');
    console.log('1. Azure AD App with "Mail.Send" application permission');
    console.log('2. Client secret created in Azure AD');
    console.log('3. Admin consent granted\n');

    // Client Secret
    const currentSecret = this.config.exchange_online.auth.client_secret;
    const secretPrompt = currentSecret
      ? 'Client Secret [****]: '
      : 'Client Secret: ';
    
    const clientSecret = await question(secretPrompt) || currentSecret;
    if (!clientSecret) {
      throw new Error('Client Secret is required for this flow');
    }
    this.config.exchange_online.auth.client_secret = clientSecret;

    // Send-as email
    const sendAs = await question('Send-as email address: ');
    if (!sendAs) {
      throw new Error('Send-as email is required for application permissions');
    }
    this.config.exchange_online.auth.send_as = sendAs;

    // Test authentication
    const test = await question('\nTest authentication now? (y/n): ');
    if (test.toLowerCase() === 'y') {
      const oauth2Manager = new OAuth2FlowManager(this.config.exchange_online, logger);
      
      try {
        console.log('\nTesting Client Credentials authentication...');
        const result = await oauth2Manager.getClientCredentialsToken();
        
        if (result.success) {
          console.log('✅ Authentication test successful!');
        }
      } catch (error) {
        console.error('❌ Authentication test failed:', error.message);
        throw error;
      }
    }

    console.log('\n✓ Client Credentials configured\n');
  }

  async setupAuthorizationCode() {
    console.log('🌐 Authorization Code Flow Setup:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Prerequisites:');
    console.log('1. Azure AD App with "Mail.Send" delegated permission');
    console.log('2. Redirect URI configured in Azure AD');
    console.log('3. Client secret (for confidential clients)\n');

    // Client Secret (optional for public clients)
    const useSecret = await question('Use client secret? (y/n): ');
    if (useSecret.toLowerCase() === 'y') {
      const currentSecret = this.config.exchange_online.auth.client_secret;
      const secretPrompt = currentSecret
        ? 'Client Secret [****]: '
        : 'Client Secret: ';
      
      const clientSecret = await question(secretPrompt) || currentSecret;
      if (clientSecret) {
        this.config.exchange_online.auth.client_secret = clientSecret;
      }
    }

    // Redirect URI
    const currentRedirect = this.config.exchange_online.auth.redirect_uri;
    const redirectPrompt = currentRedirect
      ? `Redirect URI [${currentRedirect}]: `
      : 'Redirect URI [http://localhost:3001/api/auth/callback]: ';
    
    const redirectUri = await question(redirectPrompt) || currentRedirect || 'http://localhost:3001/api/auth/callback';
    this.config.exchange_online.auth.redirect_uri = redirectUri;

    console.log('\n✓ Authorization Code Flow configured');
    console.log('\nNote: The OAuth2 endpoints will be available at:');
    console.log(`  Login: /api/auth/microsoft/login`);
    console.log(`  Callback: /api/auth/callback\n`);
  }

  async saveConfig() {
    // Create backup
    try {
      const backupPath = `${this.configPath}.backup.${Date.now()}`;
      const currentContent = await fs.readFile(this.configPath, 'utf8');
      await fs.writeFile(backupPath, currentContent);
      console.log(`✓ Backup created: ${backupPath}`);
    } catch (error) {
      // No existing config to backup
    }

    // Save new config
    const yamlContent = yaml.stringify(this.config);
    await fs.writeFile(this.configPath, yamlContent, 'utf8');
    console.log(`✓ Configuration saved to: ${this.configPath}`);
  }
}

// Run the wizard
if (require.main === module) {
  const wizard = new SetupWizard();
  wizard.run().catch(console.error);
}

module.exports = SetupWizard;