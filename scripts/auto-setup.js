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
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}▶  ${msg}${colors.reset}`)
};

// Check if running in CI environment
const isCI = process.env.CI === 'true' || process.env.CONTINUOUS_INTEGRATION === 'true';

// Check if we should skip setup (for development)
const skipSetup = process.env.SKIP_SETUP === 'true';

// Main setup function
async function setup() {
  if (skipSetup) {
    log.info('Skipping auto-setup (SKIP_SETUP=true)');
    return;
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('    📧 SMTP RELAY - AUTOMATIC SETUP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const projectRoot = path.join(__dirname, '..');
  const startTime = Date.now();

  // 1. Generate .env file with secrets
  log.step('Step 1/7: Security Configuration');
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) {
    log.info('Generating security secrets...');
    const envContent = `# Auto-generated security secrets
JWT_SECRET=${crypto.randomBytes(32).toString('hex')}
JWT_REFRESH_SECRET=${crypto.randomBytes(32).toString('hex')}
SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}
NODE_ENV=development

# SMTP Configuration
SMTP_PORT=2525
SMTP_HOST=0.0.0.0

# API Configuration
API_PORT=3001
`;
    fs.writeFileSync(envPath, envContent);
    log.success('Security secrets generated');
  } else {
    log.info('Using existing .env file');
  }

  // 2. Create config.yml if not exists
  log.step('Step 2/7: Application Configuration');
  const configPath = path.join(projectRoot, 'config.yml');
  if (!fs.existsSync(configPath)) {
    log.info('Creating default configuration...');
    const configContent = `# SMTP Relay Configuration
app:
  name: SMTP Relay
  environment: development
  debug: true

smtp:
  port: 2525
  host: 0.0.0.0
  max_size: 10485760
  timeout: 30000
  auth_optional: true
  secure: false
  reject_unauthorized: false

api:
  port: 3001
  cors: true

exchange:
  tenant_id: ""
  client_id: ""
  scopes:
    - https://graph.microsoft.com/Mail.Send
    - https://graph.microsoft.com/Mail.ReadWrite
    - https://graph.microsoft.com/User.Read
    - offline_access

storage:
  type: file
  path: ./data
  
queue:
  retry_attempts: 3
  retry_delay: 5000
  batch_size: 10
  process_interval: 5000

logging:
  level: info
  file: ./logs/smtp-relay.log
  max_files: 5
  max_size: 10m

security:
  allowed_domains: []
  allowed_ips: []
  reject_unauthorized: true
`;
    fs.writeFileSync(configPath, configContent);
    log.success('Configuration file created');
  } else {
    log.info('Using existing config.yml');
  }

  // 3. Create data directories and default admin user
  log.step('Step 3/7: Data Setup');
  const dataDir = path.join(process.cwd(), 'data');
  const usersPath = path.join(dataDir, 'users.json');
  const mfaPath = path.join(dataDir, 'mfa.json');
  const encKeyPath = path.join(dataDir, '.encryption.key');
  
  // Create data directory
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log.success('Data directory created');
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
          passwordLastChanged: new Date().toISOString(),
          passwordHistory: []
        }
      };
      
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      
      // Create empty MFA file
      fs.writeFileSync(mfaPath, JSON.stringify({}, null, 2));
      
      log.success('Default admin user created (username: admin, password: admin)');
      log.warning('IMPORTANT: Change the default password after first login!');
    } catch (err) {
      log.error(`Failed to create admin user: ${err.message}`);
    }
  } else {
    log.info('Using existing users database');
  }

  // 4. Create logs directory
  log.step('Step 4/7: Logs Directory');
  const logsDir = path.join(projectRoot, 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
    log.success('Logs directory created');
  } else {
    log.info('Logs directory already exists');
  }

  // 5. Install dashboard dependencies (ALWAYS run this)
  log.step('Step 5/7: Dashboard Dependencies');
  const dashboardPath = path.join(projectRoot, 'dashboard');
  
  if (fs.existsSync(dashboardPath)) {
    log.info('Installing/updating dashboard dependencies...');
    try {
      // Clean install to ensure consistency
      execSync('npm ci --silent', { 
        cwd: dashboardPath,
        stdio: isCI ? 'ignore' : 'inherit'
      });
      log.success('Dashboard dependencies installed');
    } catch (err) {
      // Fallback to regular install if ci fails
      try {
        execSync('npm install --silent', { 
          cwd: dashboardPath,
          stdio: isCI ? 'ignore' : 'inherit'
        });
        log.success('Dashboard dependencies installed');
      } catch (installErr) {
        log.warning('Could not install dashboard dependencies automatically');
        log.info('Please run manually: cd dashboard && npm install');
      }
    }
  } else {
    log.warning('Dashboard directory not found');
  }

  // 6. Build dashboard (ALWAYS build in production, optional in dev)
  log.step('Step 6/7: Dashboard Build');
  if (fs.existsSync(dashboardPath)) {
    const shouldBuild = process.env.NODE_ENV === 'production' || !fs.existsSync(path.join(dashboardPath, 'dist'));
    
    if (shouldBuild) {
      log.info('Building dashboard for production...');
      try {
        execSync('npm run build', { 
          cwd: dashboardPath,
          stdio: isCI ? 'ignore' : 'inherit'
        });
        log.success('Dashboard built successfully');
      } catch (err) {
        log.error('Failed to build dashboard');
        log.info('Please run manually: cd dashboard && npm run build');
      }
    } else {
      // In development, only rebuild if source files are newer than dist
      const distPath = path.join(dashboardPath, 'dist');
      const srcPath = path.join(dashboardPath, 'src');
      
      try {
        const distStats = fs.statSync(path.join(distPath, 'index.html'));
        const srcFiles = getAllFiles(srcPath);
        const needsRebuild = srcFiles.some(file => {
          const stats = fs.statSync(file);
          return stats.mtime > distStats.mtime;
        });
        
        if (needsRebuild) {
          log.info('Source files changed, rebuilding dashboard...');
          execSync('npm run build', { 
            cwd: dashboardPath,
            stdio: isCI ? 'ignore' : 'inherit'
          });
          log.success('Dashboard rebuilt successfully');
        } else {
          log.info('Dashboard is up to date');
        }
      } catch (err) {
        // If we can't determine, just build it
        log.info('Building dashboard...');
        try {
          execSync('npm run build', { 
            cwd: dashboardPath,
            stdio: isCI ? 'ignore' : 'inherit'
          });
          log.success('Dashboard built successfully');
        } catch (buildErr) {
          log.warning('Could not build dashboard automatically');
          log.info('Please run manually: cd dashboard && npm run build');
        }
      }
    }
  }

  // 7. Check if PM2 is installed globally
  log.step('Step 7/7: Process Manager Check');
  try {
    execSync('pm2 --version', { stdio: 'ignore' });
    log.success('PM2 is installed');
    log.info('You can start the app with: npm run pm2:start');
  } catch (err) {
    log.info('PM2 not found. Installing globally...');
    try {
      execSync('npm install -g pm2', { stdio: isCI ? 'ignore' : 'inherit' });
      log.success('PM2 installed successfully');
    } catch (installErr) {
      log.warning('Could not install PM2 automatically');
      log.info('Install manually with: npm install -g pm2');
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  🎉 Setup Complete! (${elapsed}s)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  Start the application with one of these commands:');
  console.log('  • npm start           - Start with Node.js');
  console.log('  • npm run dev         - Start in development mode');
  console.log('  • npm run pm2:start   - Start with PM2 (recommended)');
  console.log('  • npm run pm2:dev     - Start with PM2 in dev mode');
  console.log('');
  console.log('  📊 Dashboard:     http://localhost:3001');
  console.log('  👤 Username:      admin');
  console.log('  🔑 Password:      admin');
  console.log('  📧 SMTP Port:     2525');
  console.log('');
}

// Helper function to get all files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
  try {
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    });
    
    return arrayOfFiles;
  } catch (err) {
    return arrayOfFiles;
  }
}

// Run setup
setup().catch(err => {
  log.error(`Setup failed: ${err.message}`);
  process.exit(1);
});