#!/usr/bin/env node

const { getInstance } = require('../src/services/tokenManager.js');
const path = require('path');

async function cleanupInvalidTokens() {
    console.log('🧹 Starting token cleanup...\n');
    
    // Initialize token manager
    const tokenManager = getInstance(console);
    await tokenManager.initialize();
    
    // Get all accounts
    const accounts = await tokenManager.listAccounts();
    console.log(`Found ${accounts.length} account(s)\n`);
    
    let removedCount = 0;
    
    for (const account of accounts) {
        // Check for invalid accounts (undefined email/displayName or invalid ID)
        if (!account.email || account.email === 'undefined' || 
            !account.displayName || account.displayName === 'undefined' ||
            account.id === 'undefined_undefined' ||
            (!account.tenantId && !account.clientId)) {
            
            console.log(`❌ Invalid account found:`);
            console.log(`   ID: ${account.id}`);
            console.log(`   Email: ${account.email || 'undefined'}`);
            console.log(`   Display Name: ${account.displayName || 'undefined'}`);
            
            try {
                // Remove the invalid account
                await tokenManager.removeAccount(account.id);
                console.log(`   ✅ Removed successfully\n`);
                removedCount++;
            } catch (error) {
                console.error(`   ⚠️ Failed to remove: ${error.message}\n`);
            }
        } else {
            console.log(`✅ Valid account: ${account.email} (${account.displayName})`);
            
            // Check token status
            const tokens = await tokenManager.getAccountTokens(account.id || account.email);
            if (tokens && tokens.activeToken) {
                const expiresAt = tokens.activeToken.expiresAt;
                const now = Date.now();
                const timeLeft = expiresAt - now;
                
                if (timeLeft > 0) {
                    console.log(`   Token valid for ${Math.round(timeLeft / 1000 / 60)} minutes\n`);
                } else {
                    console.log(`   ⚠️ Token expired\n`);
                }
            } else {
                console.log(`   ⚠️ No active token\n`);
            }
        }
    }
    
    if (removedCount > 0) {
        console.log(`\n🎯 Cleanup complete: Removed ${removedCount} invalid account(s)`);
    } else {
        console.log(`\n✨ No invalid accounts found - token storage is clean`);
    }
}

// Run the cleanup
cleanupInvalidTokens().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});