#!/usr/bin/env node

/**
 * Security Vulnerability Scanner
 * Checks for common security issues and misconfigurations
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityChecker {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passed = [];
  }

  run() {
    console.log('🔍 SMTP Relay Security Check');
    console.log('============================\n');

    this.checkEnvironmentFiles();
    this.checkDependencies();
    this.checkFilePermissions();
    this.checkSensitiveData();
    this.checkCertificates();
    this.checkConfiguration();

    this.printResults();
  }

  checkEnvironmentFiles() {
    console.log('Checking environment files...');

    // Check if .env files are in .gitignore
    if (fs.existsSync('.gitignore')) {
      const gitignore = fs.readFileSync('.gitignore', 'utf8');
      if (!gitignore.includes('.env')) {
        this.issues.push('❌ .env files not in .gitignore');
      } else {
        this.passed.push('✅ .env files properly ignored');
      }
    }

    // Check if production env exists
    if (fs.existsSync('.env.production')) {
      const stats = fs.statSync('.env.production');
      const mode = (stats.mode & parseInt('777', 8)).toString(8);
      if (mode !== '600') {
        this.issues.push(`❌ .env.production has insecure permissions: ${mode} (should be 600)`);
      } else {
        this.passed.push('✅ .env.production has secure permissions');
      }
    }

    // Check for example files with real credentials
    if (fs.existsSync('.env.example')) {
      const content = fs.readFileSync('.env.example', 'utf8');
      if (!/CHANGE_THIS|your-.*-here|example\.com/i.test(content)) {
        this.warnings.push('⚠️  .env.example might contain real credentials');
      }
    }
  }

  checkDependencies() {
    console.log('Checking dependencies...');

    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.metadata.vulnerabilities.high > 0) {
        this.issues.push(`❌ ${audit.metadata.vulnerabilities.high} high severity vulnerabilities in dependencies`);
      }
      if (audit.metadata.vulnerabilities.critical > 0) {
        this.issues.push(`❌ ${audit.metadata.vulnerabilities.critical} CRITICAL vulnerabilities in dependencies`);
      }
      if (audit.metadata.vulnerabilities.moderate > 0) {
        this.warnings.push(`⚠️  ${audit.metadata.vulnerabilities.moderate} moderate vulnerabilities`);
      }
      
      if (audit.metadata.vulnerabilities.total === 0) {
        this.passed.push('✅ No known vulnerabilities in dependencies');
      }
    } catch (error) {
      // npm audit returns non-zero exit code if vulnerabilities found
      try {
        const audit = JSON.parse(error.stdout);
        if (audit.metadata) {
          if (audit.metadata.vulnerabilities.critical > 0) {
            this.issues.push(`❌ ${audit.metadata.vulnerabilities.critical} CRITICAL vulnerabilities found!`);
          }
          if (audit.metadata.vulnerabilities.high > 0) {
            this.issues.push(`❌ ${audit.metadata.vulnerabilities.high} high severity vulnerabilities`);
          }
        }
      } catch (e) {
        this.warnings.push('⚠️  Could not run npm audit');
      }
    }
  }

  checkFilePermissions() {
    console.log('Checking file permissions...');

    const sensitiveFiles = [
      'config.yml',
      '.env',
      '.env.production',
      'certs/key.pem',
      'certs/cert.pem'
    ];

    sensitiveFiles.forEach(file => {
      if (fs.existsSync(file)) {
        const stats = fs.statSync(file);
        const mode = (stats.mode & parseInt('777', 8)).toString(8);
        
        if (mode[1] !== '0' || mode[2] !== '0') {
          this.issues.push(`❌ ${file} is readable by group/others: ${mode}`);
        }
      }
    });
  }

  checkSensitiveData() {
    console.log('Checking for hardcoded secrets...');

    const patterns = [
      { pattern: /password\s*[:=]\s*["'][^"']+["']/gi, name: 'Hardcoded passwords' },
      { pattern: /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi, name: 'API keys' },
      { pattern: /secret\s*[:=]\s*["'][^"']+["']/gi, name: 'Secrets' },
      { pattern: /token\s*[:=]\s*["'][^"']+["']/gi, name: 'Tokens' },
      { pattern: /Admin123|Help123|Pass123|password123/gi, name: 'Default passwords' }
    ];

    const scanDir = (dir, ignore = ['node_modules', '.git', 'dist', 'build']) => {
      const files = fs.readdirSync(dir);
      
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          if (!ignore.includes(file)) {
            scanDir(fullPath, ignore);
          }
        } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.json')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          
          patterns.forEach(({ pattern, name }) => {
            const matches = content.match(pattern);
            if (matches && !fullPath.includes('.example') && !fullPath.includes('test')) {
              this.warnings.push(`⚠️  Possible ${name} in ${fullPath}`);
            }
          });
        }
      });
    };

    scanDir('./src');
  }

  checkCertificates() {
    console.log('Checking TLS certificates...');

    if (fs.existsSync('certs/cert.pem')) {
      try {
        const certInfo = execSync('openssl x509 -in certs/cert.pem -noout -dates', { encoding: 'utf8' });
        const notAfter = certInfo.match(/notAfter=(.*)/)[1];
        const expiryDate = new Date(notAfter);
        const daysUntilExpiry = Math.floor((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) {
          this.issues.push('❌ TLS certificate has EXPIRED!');
        } else if (daysUntilExpiry < 30) {
          this.warnings.push(`⚠️  TLS certificate expires in ${daysUntilExpiry} days`);
        } else {
          this.passed.push(`✅ TLS certificate valid for ${daysUntilExpiry} days`);
        }
      } catch (error) {
        this.warnings.push('⚠️  Could not check certificate expiry');
      }
    }
  }

  checkConfiguration() {
    console.log('Checking configuration...');

    // Check if config uses environment variables
    if (fs.existsSync('config.yml')) {
      const config = fs.readFileSync('config.yml', 'utf8');
      
      if (config.includes('your-tenant-id') || config.includes('your-client-id')) {
        this.issues.push('❌ config.yml contains placeholder values');
      }
      
      if (!/\${.*}|\$\(.*\)|process\.env/g.test(config)) {
        this.warnings.push('⚠️  config.yml should use environment variables for secrets');
      }
    }
  }


  printResults() {
    console.log('\n📊 Security Check Results');
    console.log('========================\n');

    if (this.passed.length > 0) {
      console.log('✅ Passed Checks:');
      this.passed.forEach(p => console.log(`   ${p}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(w => console.log(`   ${w}`));
      console.log('');
    }

    if (this.issues.length > 0) {
      console.log('❌ Critical Issues:');
      this.issues.forEach(i => console.log(`   ${i}`));
      console.log('');
    }

    // Summary
    console.log('📈 Summary:');
    console.log(`   Passed: ${this.passed.length}`);
    console.log(`   Warnings: ${this.warnings.length}`);
    console.log(`   Issues: ${this.issues.length}`);

    if (this.issues.length > 0) {
      console.log('\n🚨 SECURITY ISSUES DETECTED! Fix critical issues before deployment.');
      process.exit(1);
    } else if (this.warnings.length > 0) {
      console.log('\n⚠️  Some warnings detected. Review and fix if necessary.');
    } else {
      console.log('\n✅ All security checks passed!');
    }
  }
}

// Run the checker
const checker = new SecurityChecker();
checker.run();