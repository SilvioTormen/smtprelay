#!/usr/bin/env node

/**
 * Security Secret Generator
 * Generates secure secrets for production deployment
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 SMTP Relay Security Configuration Generator');
console.log('==============================================\n');

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('base64').replace(/[+/=]/g, '');
}

function generatePassword(length = 16) {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const all = uppercase + lowercase + numbers + special;
  
  let password = '';
  password += uppercase[crypto.randomInt(uppercase.length)];
  password += lowercase[crypto.randomInt(lowercase.length)];
  password += numbers[crypto.randomInt(numbers.length)];
  password += special[crypto.randomInt(special.length)];
  
  for (let i = password.length; i < length; i++) {
    password += all[crypto.randomInt(all.length)];
  }
  
  return password.split('').sort(() => crypto.randomInt(3) - 1).join('');
}

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('This tool will generate secure secrets for your production deployment.\n');
  
  const domain = await askQuestion('Enter your domain name (e.g., smtp-relay.company.com): ');
  const tenantId = await askQuestion('Enter your Azure Tenant ID: ');
  const clientId = await askQuestion('Enter your Azure Client ID: ');
  const clientSecret = await askQuestion('Enter your Azure Client Secret: ');
  
  const config = `# SMTP Relay Production Configuration
# Generated: ${new Date().toISOString()}
# IMPORTANT: Keep this file secure and never commit to version control!

# Node Environment
NODE_ENV=production

# JWT Secrets (Auto-generated - Do not change)
JWT_SECRET=${generateSecret(64)}
JWT_REFRESH_SECRET=${generateSecret(64)}

# Session Secret (Auto-generated - Do not change)
SESSION_SECRET=${generateSecret(64)}

# Database Passwords (Auto-generated - Change if needed)
DB_PASSWORD=${generatePassword(20)}
REDIS_PASSWORD=${generatePassword(20)}

# Exchange Online OAuth2
AZURE_TENANT_ID=${tenantId}
AZURE_CLIENT_ID=${clientId}
AZURE_CLIENT_SECRET=${clientSecret}

# FIDO2/WebAuthn Configuration
RP_ID=${domain}
ORIGIN=https://${domain}

# Initial Admin Accounts (Change after first login!)
ADMIN_INITIAL_PASSWORD=${generatePassword(16)}
HELPDESK_INITIAL_PASSWORD=${generatePassword(16)}

# Security Settings
ENFORCE_MFA=true
PASSWORD_MIN_LENGTH=12
SESSION_TIMEOUT=1800000
MAX_LOGIN_ATTEMPTS=3
LOCKOUT_DURATION=1800000

# HTTPS/TLS
TLS_CERT_PATH=/etc/smtp-relay/certs/cert.pem
TLS_KEY_PATH=/etc/smtp-relay/certs/key.pem
FORCE_HTTPS=true

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/smtp-relay/app.log

# Monitoring (Optional)
# SENTRY_DSN=your-sentry-dsn-here
`;

  const envPath = path.join(process.cwd(), '.env.production');
  
  if (fs.existsSync(envPath)) {
    const overwrite = await askQuestion('\n⚠️  .env.production already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }
  
  fs.writeFileSync(envPath, config);
  
  // Set restrictive permissions (owner read/write only)
  fs.chmodSync(envPath, 0o600);
  
  console.log('\n✅ Configuration generated successfully!');
  console.log(`📁 File saved to: ${envPath}`);
  console.log('\n⚠️  IMPORTANT NOTES:');
  console.log('1. Keep this file secure - it contains sensitive secrets');
  console.log('2. Never commit this file to version control');
  console.log('3. Change the initial admin passwords after first login');
  console.log('4. Backup this file securely');
  console.log('\n📋 Initial Credentials:');
  
  const lines = config.split('\n');
  const adminPass = lines.find(l => l.startsWith('ADMIN_INITIAL_PASSWORD=')).split('=')[1];
  const helpdeskPass = lines.find(l => l.startsWith('HELPDESK_INITIAL_PASSWORD=')).split('=')[1];
  
  console.log(`   Admin:    admin / ${adminPass}`);
  console.log(`   Helpdesk: helpdesk / ${helpdeskPass}`);
  console.log('\n🔒 Security Checklist:');
  console.log('   [ ] File permissions set to 600 (owner only)');
  console.log('   [ ] SSL/TLS certificates installed');
  console.log('   [ ] Firewall configured');
  console.log('   [ ] MFA enabled for all users');
  console.log('   [ ] Regular security updates scheduled');
  
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});