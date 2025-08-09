#!/usr/bin/env node

/**
 * Automatic Setup Script
 * Runs after npm install to set up the application
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`)
};

// Main setup function
async function setup() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('    📧 SMTP RELAY - AUTOMATIC SETUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const projectRoot = path.join(__dirname, '..');

  // 1. Generate .env file with secrets
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) {
    log.info('Generating security secrets...');
    const envContent = `# Auto-generated security secrets
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
JWT_REFRESH_SECRET=${crypto.randomBytes(32).toString('hex')}
SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
NODE_ENV=development
`;
    fs.writeFileSync(envPath, envContent);
    log.success('Security secrets generated');
  } else {
    log.info('Using existing .env file');
  }

  // 2. Create default config.yml
  const configPath = path.join(projectRoot, 'config.yml');
  if (!fs.existsSync(configPath)) {
    log.info('Creating default configuration...');
    
    // Try to copy from example first
    const exampleConfigPath = path.join(projectRoot, 'config.example.yml');
    if (fs.existsSync(exampleConfigPath)) {
      fs.copyFileSync(exampleConfigPath, configPath);
    } else {
      // Create minimal config
      const configContent = `# SMTP Relay Configuration
smtp:
  host: 0.0.0.0
  port: 2525
  secure: false
  auth:
    enabled: false

dashboard:
  enabled: true
  port: 3001
  session_secret: \${SESSION_SECRET}

# Exchange Online Configuration (configure via dashboard)
exchange_online:
  host: smtp.office365.com
  port: 587
  secure: false
  auth:
    method: device_code

rate_limit:
  enabled: true
  max_connections: 10
  messages_per_minute: 30

queue:
  retry_attempts: 3
  retry_delay: 60

logging:
  level: info
  file: ./logs/smtp-relay.log

security:
  allowed_domains: []
  allowed_ips: []
  reject_unauthorized: true
`;
      fs.writeFileSync(configPath, configContent);
    }
    log.success('Configuration file created');
  } else {
    log.info('Using existing config.yml');
  }

  // 3. Create default admin user in correct location (/data)
  const dataDir = path.join(process.cwd(), 'data');
  const usersPath = path.join(dataDir, 'users.json');
  const mfaPath = path.join(dataDir, 'mfa.json');
  const encKeyPath = path.join(dataDir, '.encryption.key');
  
  // Create data directory
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(usersPath)) {
    log.info('Creating default admin user...');
    
    try {
      const bcrypt = require('bcrypt');
      
      // Create encryption key for the service
      const ENCRYPTION_KEY = crypto.randomBytes(32);
      fs.writeFileSync(encKeyPath, ENCRYPTION_KEY.toString('hex'));
      
      // Create admin user
      const adminPassword = bcrypt.hashSync('admin', 10);
      const users = {
        admin: {
          id: '1',
          username: 'admin',
          password: adminPassword,
          role: 'admin',
          permissions: ['read', 'write', 'delete', 'configure', 'manage_users'],
          displayName: 'Administrator',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          failedAttempts: 0,
          lockedUntil: null,
          totpSecret: null,
          totpEnabled: false,
          mfaEnforced: false,
          lastLogin: null,
          passwordChangedAt: new Date().toISOString(),
          requirePasswordChange: false,
          locked: false
        }
      };
      
      // Write users file
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      
      // Create empty MFA file (no MFA enabled by default!)
      fs.writeFileSync(mfaPath, JSON.stringify({}));
      
      log.success('Default admin user created (username: admin, password: admin)');
      log.warning('IMPORTANT: Change the default password after first login!');
    } catch (err) {
      log.warning('Could not create default user. Run "npm run setup:auth" after installation.');
    }
  } else {
    log.info('Users file already exists');
  }

  // 4. Create logs directory
  const logsPath = path.join(projectRoot, 'logs');
  if (!fs.existsSync(logsPath)) {
    fs.mkdirSync(logsPath, { recursive: true });
    log.success('Logs directory created');
  }

  // 5. Install dashboard dependencies if needed
  const dashboardNodeModules = path.join(projectRoot, 'dashboard', 'node_modules');
  if (!fs.existsSync(dashboardNodeModules)) {
    log.info('Installing dashboard dependencies...');
    try {
      execSync('npm install', { 
        cwd: path.join(projectRoot, 'dashboard'),
        stdio: 'ignore'
      });
      log.success('Dashboard dependencies installed');
    } catch (err) {
      log.warning('Could not install dashboard dependencies automatically');
      log.info('Run: cd dashboard && npm install');
    }
  }

  // 6. Build dashboard
  const dashboardDist = path.join(projectRoot, 'dashboard', 'dist');
  if (!fs.existsSync(dashboardDist)) {
    log.info('Building dashboard...');
    try {
      execSync('npm run build', { 
        cwd: path.join(projectRoot, 'dashboard'),
        stdio: 'ignore'
      });
      log.success('Dashboard built successfully');
    } catch (err) {
      log.warning('Could not build dashboard automatically');
      log.info('Run: cd dashboard && npm run build');
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 Setup Complete!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  Start the application with one of these commands:');
  console.log('  • npm start           - Start with Node.js');
  console.log('  • npm run pm2         - Start with PM2 (recommended)');
  console.log('  • ./install.sh        - Run full installation wizard');
  console.log('');
  console.log('  📊 Dashboard:     http://localhost:3001');
  console.log('  👤 Username:      admin');
  console.log('  🔑 Password:      admin');
  console.log('  📧 SMTP Port:     2525\n');
}

// Run setup
setup().catch(err => {
  log.error(`Setup failed: ${err.message}`);
  process.exit(1);
});