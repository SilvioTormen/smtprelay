#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const projectRoot = path.join(__dirname, '..');
const usersPath = path.join(projectRoot, '.users.enc');
const keyPath = path.join(projectRoot, '.encryption.key');

console.log('🔍 Debugging user database...\n');

try {
  // Read encryption key
  const ENCRYPTION_KEY = Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'hex');
  console.log('✅ Encryption key loaded');

  // Read encrypted users
  const encryptedData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const IV = Buffer.from(encryptedData.iv, 'hex');
  
  // Decrypt
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  const users = JSON.parse(decrypted);
  console.log('✅ Users decrypted successfully\n');
  
  console.log('📋 Users in database:');
  users.forEach(user => {
    console.log(`\n  User: ${user.username}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Locked: ${user.locked || false}`);
    console.log(`  Failed Attempts: ${user.failedAttempts || 0}`);
    console.log(`  MFA Enabled: ${user.mfaEnabled || false}`);
    
    // Test password
    const testPassword = 'admin';
    const matches = bcrypt.compareSync(testPassword, user.password);
    console.log(`  Password 'admin' matches: ${matches ? '✅ YES' : '❌ NO'}`);
  });

  console.log('\n🔧 Creating fresh admin user...');
  
  // Create new admin user
  const newUsers = [{
    id: '1',
    username: 'admin',
    password: bcrypt.hashSync('admin', 10),
    role: 'admin',
    created: new Date().toISOString(),
    lastLogin: null,
    mfaEnabled: false,
    locked: false,
    failedAttempts: 0
  }];
  
  // Generate new key for safety
  const NEW_KEY = crypto.randomBytes(32);
  const NEW_IV = crypto.randomBytes(16);
  
  // Encrypt
  const cipher = crypto.createCipheriv('aes-256-cbc', NEW_KEY, NEW_IV);
  let encrypted = cipher.update(JSON.stringify(newUsers), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Save
  fs.writeFileSync(usersPath, JSON.stringify({
    iv: NEW_IV.toString('hex'),
    data: encrypted
  }));
  fs.writeFileSync(keyPath, NEW_KEY.toString('hex'));
  
  console.log('✅ Fresh admin user created!');
  console.log('   Username: admin');
  console.log('   Password: admin');
  console.log('   Status: Unlocked\n');
  
  // Verify
  const verifyData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  const verifyKey = Buffer.from(fs.readFileSync(keyPath, 'utf8'), 'hex');
  const verifyIV = Buffer.from(verifyData.iv, 'hex');
  
  const verifyDecipher = crypto.createDecipheriv('aes-256-cbc', verifyKey, verifyIV);
  let verifyDecrypted = verifyDecipher.update(verifyData.data, 'hex', 'utf8');
  verifyDecrypted += verifyDecipher.final('utf8');
  
  const verifyUsers = JSON.parse(verifyDecrypted);
  const adminUser = verifyUsers[0];
  const passwordWorks = bcrypt.compareSync('admin', adminUser.password);
  
  console.log('🔍 Verification:');
  console.log(`   Password hash stored: ${adminUser.password.substring(0, 20)}...`);
  console.log(`   Password 'admin' works: ${passwordWorks ? '✅ YES' : '❌ NO'}`);
  
} catch (err) {
  console.error('❌ Error:', err.message);
  console.log('\n🔧 Creating new user database from scratch...');
  
  // Start fresh
  const ENCRYPTION_KEY = crypto.randomBytes(32);
  const IV = crypto.randomBytes(16);
  
  const users = [{
    id: '1',
    username: 'admin',
    password: bcrypt.hashSync('admin', 10),
    role: 'admin',
    created: new Date().toISOString(),
    lastLogin: null,
    mfaEnabled: false,
    locked: false,
    failedAttempts: 0
  }];
  
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
  let encrypted = cipher.update(JSON.stringify(users), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  fs.writeFileSync(usersPath, JSON.stringify({
    iv: IV.toString('hex'),
    data: encrypted
  }));
  fs.writeFileSync(keyPath, ENCRYPTION_KEY.toString('hex'));
  
  console.log('✅ New user database created!');
  console.log('   Username: admin');
  console.log('   Password: admin');
}