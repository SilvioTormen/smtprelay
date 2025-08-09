#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

async function fixAdminLogin() {
  console.log('🔧 Fixing admin login for the running application...\n');
  
  const dataDir = path.join('/smtprelay', 'data');
  const usersFile = path.join(dataDir, 'users.json');
  
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(dataDir, { recursive: true });
    console.log('✅ Data directory ensured');
    
    // Create admin user with correct password hash
    const adminPassword = await bcrypt.hash('admin', 10);
    
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
    await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
    console.log('✅ Admin user created in /data/users.json');
    
    // Verify the password hash
    const testPassword = await bcrypt.compare('admin', adminPassword);
    console.log(`✅ Password verification: ${testPassword ? 'SUCCESS' : 'FAILED'}`);
    
    console.log('\n🎉 Admin login fixed!');
    console.log('   Username: admin');
    console.log('   Password: admin');
    console.log('\n⚠️  You may need to restart the app for changes to take effect.');
    
  } catch (error) {
    console.error('❌ Error fixing admin login:', error.message);
    process.exit(1);
  }
}

fixAdminLogin();