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

      // Get Azure AD details
      await this.getAzureDetails();

      // Configure device code flow
      await this.setupDeviceCode();

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
    
    // Ask which API to use
    console.log('🎯 Which API method do you want to use?\n');
    console.log('1. Microsoft Graph API (✅ RECOMMENDED - Modern & Future-proof)');
    console.log('   Required Permission: Mail.Send (Microsoft Graph)');
    console.log('   SMTP Auth on mailbox: NOT required\n');
    
    console.log('2. SMTP Protocol with OAuth2 (⚠️ Legacy - Being phased out)');
    console.log('   Required Permission: SMTP.Send (Office 365 Exchange)');
    console.log('   SMTP Auth on mailbox: MUST be enabled\n');
    
    console.log('3. Both APIs - Hybrid Mode (🔄 Automatic fallback)');
    console.log('   Required: BOTH permissions');
    console.log('   Provides maximum compatibility\n');
    
    const apiChoice = await question('Select API method (1-3) [1]: ') || '1';
    
    let apiMethod = 'graph_api';
    let requiredPermissions = [];
    
    switch(apiChoice) {
      case '1':
        apiMethod = 'graph_api';
        requiredPermissions = ['Mail.Send (Microsoft Graph)'];
        console.log('\n✅ Selected: Microsoft Graph API (Recommended)\n');
        break;
      case '2':
        apiMethod = 'smtp_oauth2';
        requiredPermissions = ['SMTP.Send (Office 365 Exchange Online)'];
        console.log('\n⚠️  Selected: SMTP OAuth2 (Legacy)\n');
        break;
      case '3':
        apiMethod = 'hybrid';
        requiredPermissions = ['Mail.Send (Microsoft Graph)', 'SMTP.Send (Office 365 Exchange)'];
        console.log('\n🔄 Selected: Hybrid Mode (Both APIs)\n');
        break;
    }
    
    this.config.exchange_online.auth.method = 'device_code';
    this.config.exchange_online.method = apiMethod;
    
    console.log('📋 Required Azure AD Configuration:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('1. Required Permissions:');
    requiredPermissions.forEach(perm => console.log(`   - ${perm}`));
    console.log('\n2. App Settings:');
    console.log('   - Public client flow: Enabled');
    console.log('   - Admin consent: Required\n');

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