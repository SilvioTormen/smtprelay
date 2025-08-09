#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

async function fixRealAdmin() {
  console.log('🔧 Fixing admin login in the ACTUAL location...\n');
  
  // The app uses /data not /smtprelay/data!
  const dataDir = '/data';
  const usersFile = path.join(dataDir, 'users.json');
  
  try {
    // Read existing users
    const existingData = await fs.readFile(usersFile, 'utf8');
    const users = JSON.parse(existingData);
    
    console.log('📋 Found', Object.keys(users).length, 'users:', Object.keys(users).join(', '));
    
    // Fix admin user
    if (users.admin) {
      // Update password to 'admin'
      users.admin.password = await bcrypt.hash('admin', 10);
      users.admin.failedAttempts = 0;
      users.admin.lockedUntil = null;
      users.admin.locked = false;
      users.admin.updatedAt = new Date().toISOString();
      
      console.log('✅ Reset admin password and unlocked account');
    } else {
      // Create admin user if doesn't exist
      users.admin = {
        id: '1',
        username: 'admin',
        password: await bcrypt.hash('admin', 10),
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
      };
      console.log('✅ Created new admin user');
    }
    
    // Write back
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    
    // Verify the password
    const testPassword = await bcrypt.compare('admin', users.admin.password);
    console.log(`✅ Password verification: ${testPassword ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Failed attempts: ${users.admin.failedAttempts}`);
    console.log(`✅ Account locked: ${users.admin.lockedUntil ? 'YES until ' + new Date(users.admin.lockedUntil) : 'NO'}`);
    
    console.log('\n🎉 Admin login fixed!');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('   Status: Unlocked');
    console.log('\n⚠️  Restart the app: pm2 restart smtp-relay');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixRealAdmin();