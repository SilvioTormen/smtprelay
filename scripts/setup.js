#!/usr/bin/env node

/**
 * Initial Setup Script for SMTP Relay
 * Checks prerequisites and prepares the environment
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SetupScript {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  async run() {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 SMTP RELAY INITIAL SETUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check Node.js version
    this.checkNodeVersion();
    
    // Check for required directories
    this.createDirectories();
    
    // Check for config file
    this.checkConfig();
    
    // Check for certificates
    this.checkCertificates();
    
    // Check Redis availability
    this.checkRedis();
    
    // Check firewall ports
    this.checkFirewall();
    
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
    } else if (major === 18 || major === 19) {
      this.warnings.push(`Node.js ${nodeVersion} works but v20 LTS is recommended`);
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
        execSync(`openssl req -x509 -newkey rsa:4096 -keyout ${keyPath} -out ${certPath} -days 365 -nodes -subj "/CN=smtp-relay.local"`, {
          cwd: certsDir,
          stdio: 'ignore'
        });
        this.success.push('✅ Generated self-signed certificates');
      } catch (error) {
        this.warnings.push('⚠️  Could not generate certificates - TLS may not work');
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
      console.log('   Install Redis: sudo dnf install redis && sudo systemctl start redis');
    }
  }

  checkFirewall() {
    try {
      const result = execSync('sudo firewall-cmd --list-ports', { encoding: 'utf8' });
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
      console.log('1. Configure OAuth2: npm run setup:auth');
      console.log('2. Generate secrets: npm run security:generate');
      console.log('3. Start service: npm start');
    } else {
      console.log('❌ Please fix the errors before continuing');
      process.exit(1);
    }
  }
}

// Run setup
const setup = new SetupScript();
setup.run().catch(console.error);