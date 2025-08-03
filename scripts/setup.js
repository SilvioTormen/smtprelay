#!/usr/bin/env node

/**
 * Initial Setup Script for SMTP Relay
 * Checks prerequisites and prepares the environment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const readline = require('readline');

class SetupScript {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
    this.nonInteractive = process.argv.includes('--non-interactive') || process.env.CI === 'true';
  }

  async run() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 SMTP RELAY INITIAL SETUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check Node.js version
    this.checkNodeVersion();
    
    // Check for required directories
    this.createDirectories();
    
    // Check and create .env file with secure defaults
    await this.setupEnvironment();
    
    // Check for config file
    this.checkConfig();
    
    // Check for certificates
    this.checkCertificates();
    
    // Install dashboard dependencies
    this.installDashboardDependencies();
    
    // Check Redis availability
    this.checkRedis();
    
    // Check firewall ports
    this.checkFirewall();
    
    // Check port capabilities
    this.checkPortCapabilities();
    
    // Print results
    this.printResults();
    
    // Offer to run auth setup
    if (this.errors.length === 0) {
      console.log('\n✨ Would you like to configure OAuth2 authentication now?');
      console.log('   Run: npm run setup:auth\n');
    }
  }

  checkNodeVersion() {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.split('.')[0].substring(1));
    
    if (major < 18) {
      this.errors.push(`Node.js version ${nodeVersion} is too old. Required: 18+`);
      console.log('\n❌ Node.js 18+ required');
      console.log('   Install Node.js 20 LTS:');
      console.log('   curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -');
      console.log('   sudo dnf install nodejs\n');
    } else if (major === 18 || major === 19) {
      this.warnings.push(`Node.js ${nodeVersion} works but v20 LTS is recommended`);
    } else if (major >= 22) {
      // For RHEL 10 with Node.js 22 pre-installed
      this.success.push(`✅ Node.js ${nodeVersion} (system version)`);
    } else {
      this.success.push(`✅ Node.js ${nodeVersion}`);
    }
  }

  createDirectories() {
    const dirs = [
      'logs',
      'queue', 
      'certs',
      '.temp'
    ];

    dirs.forEach(dir => {
      const dirPath = path.join(__dirname, '..', dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        this.success.push(`✅ Created directory: ${dir}/`);
      }
    });
    
    // Ensure token file has correct permissions if it exists
    this.secureTokenFile();
  }
  
  secureTokenFile() {
    const tokenPath = path.join(__dirname, '..', '.tokens.json');
    
    if (fs.existsSync(tokenPath)) {
      try {
        // Set restrictive permissions (owner read/write only)
        fs.chmodSync(tokenPath, 0o600);
        this.success.push('✅ Token file permissions secured (600)');
      } catch (error) {
        this.warnings.push('⚠️  Could not set token file permissions - run as root or set manually');
        console.log('   Manual fix: sudo chmod 600 .tokens.json');
      }
    }
  }

  async setupEnvironment() {
    const envPath = path.join(__dirname, '..', '.env');
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    
    if (!fs.existsSync(envPath)) {
      console.log('\n🔐 Generating secure environment configuration...');
      
      // Generate secure random secrets
      const jwtSecret = crypto.randomBytes(32).toString('base64');
      const jwtRefreshSecret = crypto.randomBytes(32).toString('base64');
      const sessionSecret = crypto.randomBytes(32).toString('base64');
      const year = new Date().getFullYear();
      
      const envContent = `# Environment Configuration - Generated ${new Date().toISOString()}
# ============================================

# Node Environment
NODE_ENV=development

# Security Secrets (Auto-generated - Keep these secure!)
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
SESSION_SECRET=${sessionSecret}

# Initial Passwords (Change these after first login!)
ADMIN_INITIAL_PASSWORD=Admin@${year}!Secure
HELPDESK_INITIAL_PASSWORD=Helpdesk@${year}!Secure

# WebAuthn Configuration
RP_ID=localhost
ORIGIN=http://localhost:3001

# TLS Configuration
FORCE_HTTPS=false
TLS_CERT_PATH=/opt/smtp-relay/certs/cert.pem
TLS_KEY_PATH=/opt/smtp-relay/certs/key.pem

# Port Configuration
SMTP_PORT=2525
SMTP_SUBMISSION_PORT=2587
SMTPS_PORT=2465
WEB_PORT=3001

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
LOG_LEVEL=info
LOG_DIR=/var/log/smtp-relay
`;
      
      fs.writeFileSync(envPath, envContent, { mode: 0o600 });
      this.success.push('✅ Generated .env with secure secrets');
      this.warnings.push('⚠️  Default ports set to >1024 (2525, 2587, 2465) to avoid permission issues');
      this.warnings.push('⚠️  Change initial passwords after first login!');
    } else {
      // Check if existing .env has required secrets
      const envContent = fs.readFileSync(envPath, 'utf8');
      const hasJwtSecret = envContent.includes('JWT_SECRET=') && !envContent.includes('JWT_SECRET=your-secret');
      const hasRefreshSecret = envContent.includes('JWT_REFRESH_SECRET=');
      const hasSessionSecret = envContent.includes('SESSION_SECRET=');
      
      if (!hasJwtSecret || !hasRefreshSecret || !hasSessionSecret) {
        if (!this.nonInteractive) {
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise(resolve => {
            rl.question('\n⚠️  Missing security secrets in .env. Generate them now? (Y/n): ', resolve);
          });
          rl.close();
          
          if (answer.toLowerCase() !== 'n') {
            // Append missing secrets
            let additions = '\n# Auto-generated security secrets\n';
            if (!hasJwtSecret) {
              additions += `JWT_SECRET=${crypto.randomBytes(32).toString('base64')}\n`;
            }
            if (!hasRefreshSecret) {
              additions += `JWT_REFRESH_SECRET=${crypto.randomBytes(32).toString('base64')}\n`;
            }
            if (!hasSessionSecret) {
              additions += `SESSION_SECRET=${crypto.randomBytes(32).toString('base64')}\n`;
            }
            fs.appendFileSync(envPath, additions);
            this.success.push('✅ Added missing security secrets to .env');
          }
        } else {
          this.warnings.push('⚠️  Security secrets missing - run setup interactively or configure .env manually');
        }
      } else {
        this.success.push('✅ .env file configured');
      }
    }
  }

  installDashboardDependencies() {
    const dashboardPath = path.join(__dirname, '..', 'dashboard');
    const dashboardPackageJson = path.join(dashboardPath, 'package.json');
    
    if (fs.existsSync(dashboardPackageJson)) {
      try {
        console.log('\n📦 Installing dashboard dependencies...');
        execSync('npm install --prefix dashboard', { 
          cwd: path.join(__dirname, '..'),
          stdio: this.nonInteractive ? 'ignore' : 'inherit'
        });
        this.success.push('✅ Dashboard dependencies installed');
      } catch (error) {
        this.warnings.push('⚠️  Could not install dashboard dependencies');
      }
    }
  }

  checkPortCapabilities() {
    try {
      // Check if we need capabilities for low ports
      const envPath = path.join(__dirname, '..', '.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const smtpPort = envContent.match(/SMTP_PORT=(\d+)/)?.[1] || '25';
        
        if (parseInt(smtpPort) < 1024) {
          this.warnings.push('⚠️  Using privileged port (<1024) requires special permissions');
          console.log('\n   To allow Node.js to bind to ports < 1024:');
          console.log('   sudo setcap cap_net_bind_service=+ep $(which node)');
          console.log('\n   Or use ports >= 1024 (recommended for development)');
        }
      }
    } catch (error) {
      // Ignore capability check errors
    }
  }

  checkConfig() {
    const configPath = path.join(__dirname, '..', 'config.yml');
    const examplePath = path.join(__dirname, '..', 'config.example.yml');
    
    if (!fs.existsSync(configPath)) {
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, configPath);
        this.warnings.push('⚠️  Created config.yml from example - please configure it');
      } else {
        this.errors.push('❌ No config.yml or config.example.yml found');
      }
    } else {
      this.success.push('✅ config.yml exists');
    }
  }

  checkCertificates() {
    const certPath = path.join(__dirname, '..', 'certs', 'cert.pem');
    const keyPath = path.join(__dirname, '..', 'certs', 'key.pem');
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      this.warnings.push('⚠️  TLS certificates not found - will generate self-signed');
      
      // Generate self-signed certificate
      try {
        const certsDir = path.join(__dirname, '..', 'certs');
        // Check if we have write permissions
        if (!fs.existsSync(certsDir)) {
          fs.mkdirSync(certsDir, { recursive: true });
        }
        
        // Check if openssl is available
        try {
          execSync('which openssl', { stdio: 'ignore' });
        } catch {
          this.warnings.push('⚠️  OpenSSL not found - cannot generate certificates');
          return;
        }
        
        execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=smtp-relay.local"`, {
          cwd: certsDir,
          stdio: 'ignore'
        });
        this.success.push('✅ Generated self-signed certificates');
      } catch (error) {
        this.warnings.push('⚠️  Could not generate certificates - TLS may not work');
        if (error.code === 'EACCES') {
          console.log('   Permission denied - run as the service user or fix permissions');
        }
      }
    } else {
      this.success.push('✅ TLS certificates found');
    }
  }

  checkRedis() {
    try {
      execSync('redis-cli ping', { stdio: 'ignore' });
      this.success.push('✅ Redis is running');
    } catch (error) {
      this.warnings.push('⚠️  Redis not running - sessions and caching disabled');
      if (process.getuid && process.getuid() === 0) {
        console.log('   Install Redis: sudo dnf install redis && sudo systemctl start redis');
      } else {
        console.log('   Ask your admin to install Redis: dnf install redis && systemctl start redis');
      }
    }
  }

  checkFirewall() {
    // Skip firewall check if not running as root
    if (process.getuid && process.getuid() !== 0) {
      this.warnings.push('⚠️  Firewall check skipped (requires root privileges)');
      console.log('   Run as root to check firewall: sudo npm run setup');
      return;
    }
    
    try {
      // First check if firewall-cmd exists
      try {
        execSync('which firewall-cmd', { stdio: 'ignore' });
      } catch {
        this.warnings.push('⚠️  firewalld not installed - firewall check skipped');
        return;
      }
      
      // Try without sudo first (if we're already root)
      let result;
      try {
        result = execSync('firewall-cmd --list-ports', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      } catch {
        // If that fails and we're root, firewalld might not be running
        try {
          execSync('systemctl is-active firewalld', { stdio: 'ignore' });
          // Firewalld is running but we can't access it
          throw new Error('Cannot access firewall');
        } catch {
          this.warnings.push('⚠️  firewalld not running - firewall check skipped');
          return;
        }
      }
      
      const openPorts = result.trim();
      const requiredPorts = ['25', '587', '465', '3001'];
      const missingPorts = [];
      
      requiredPorts.forEach(port => {
        if (!openPorts.includes(port)) {
          missingPorts.push(port);
        }
      });
      
      if (missingPorts.length > 0) {
        this.warnings.push(`⚠️  Firewall ports not open: ${missingPorts.join(', ')}`);
        console.log('\n   Open ports with:');
        missingPorts.forEach(port => {
          console.log(`   sudo firewall-cmd --permanent --add-port=${port}/tcp`);
        });
        console.log('   sudo firewall-cmd --reload\n');
      } else {
        this.success.push('✅ All required firewall ports are open');
      }
    } catch (error) {
      this.warnings.push('⚠️  Could not check firewall status');
    }
  }

  printResults() {
    console.log('\n📊 Setup Check Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (this.success.length > 0) {
      console.log('✅ Passed:');
      this.success.forEach(item => console.log(`   ${item}`));
      console.log('');
    }
    
    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(item => console.log(`   ${item}`));
      console.log('');
    }
    
    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(item => console.log(`   ${item}`));
      console.log('');
    }
    
    if (this.errors.length === 0) {
      console.log('✨ Setup check completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Review and adjust .env configuration');
      console.log('2. Configure OAuth2: npm run setup:auth');
      console.log('3. Start service: npm start');
      console.log('\nFor production deployment:');
      console.log('- Change NODE_ENV to "production" in .env');
      console.log('- Update passwords and secrets');
      console.log('- Configure proper TLS certificates');
      console.log('- Use systemd service: sudo systemctl start smtp-relay');
    } else {
      console.log('❌ Please fix the errors before continuing');
      process.exit(1);
    }
  }
}

// Run setup
const setup = new SetupScript();
setup.run().catch(console.error);