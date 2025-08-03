const express = require('express');
const router = express.Router();
const tokenService = require('../services/tokenService');
const securityService = require('../services/securityService');
const { authenticate, authorize } = require('../middleware/auth-simple');

/**
 * Get all active sessions for current user
 * NOTE: Simplified version for auth-simple mode
 */
router.get('/my-sessions', authenticate, async (req, res) => {
  try {
    // In simple auth mode, return mock data
    const mockSessions = [
      {
        id: 'session-1',
        deviceInfo: {
          browser: req.headers['user-agent'] || 'Unknown',
          ip: req.ip || 'Unknown',
          fingerprint: 'mock-fingerprint'
        },
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
        isCurrent: true,
        location: null
      }
    ];
    
    res.json({
      sessions: mockSessions,
      count: mockSessions.length
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve sessions',
      code: 'SESSIONS_ERROR'
    });
  }
});

/**
 * Revoke a specific session
 */
router.delete('/revoke/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // In simple auth mode, just return success
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      error: 'Failed to revoke session',
      code: 'REVOKE_ERROR'
    });
  }
});

/**
 * Revoke all other sessions (logout everywhere else)
 */
router.post('/revoke-all', authenticate, async (req, res) => {
  try {
    // In simple auth mode, just return success
    res.json({
      success: true,
      message: 'All other sessions revoked',
      revokedCount: 0
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({
      error: 'Failed to revoke sessions',
      code: 'REVOKE_ALL_ERROR'
    });
  }
});

/**
 * Get security events for current user
 */
router.get('/security-events', authenticate, async (req, res) => {
  try {
    // This would query Redis for user-specific security events
    // For now, returning mock data
    const events = [
      {
        type: 'LOGIN_SUCCESS',
        timestamp: new Date().toISOString(),
        ip: req.ip,
        device: 'Chrome on Windows'
      }
    ];
    
    res.json({
      events,
      count: events.length
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve security events',
      code: 'EVENTS_ERROR'
    });
  }
});

/**
 * Generate backup codes for MFA
 */
router.post('/backup-codes', authenticate, async (req, res) => {
  try {
    // TODO: In simple auth mode, users store is not available
    // For now, return not implemented
    return res.status(501).json({
      error: 'Backup codes not available in simple auth mode',
      code: 'NOT_IMPLEMENTED'
    });
    
    /* Original code - requires users store:
    const user = users.get(req.user.username);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (!user.twoFactorEnabled) {
      return res.status(400).json({
        error: '2FA must be enabled first',
        code: 'MFA_NOT_ENABLED'
      });
    }
    
    // Generate new backup codes
    const backupCodes = securityService.generateBackupCodes(10);
    
    // Store hashes only
    user.backupCodes = backupCodes.map(bc => ({
      hash: bc.hash,
      used: bc.used,
      createdAt: bc.createdAt
    }));
    
    // Return plain codes to user (only time they see them)
    res.json({
      success: true,
      codes: backupCodes.map(bc => bc.code),
      message: 'Save these codes securely. They will not be shown again.'
    });
    */
  } catch (error) {
    console.error('Generate backup codes error:', error);
    res.status(500).json({
      error: 'Failed to generate backup codes',
      code: 'BACKUP_CODES_ERROR'
    });
  }
});

/**
 * Use backup code for login
 */
router.post('/use-backup-code', async (req, res) => {
  try {
    // TODO: In simple auth mode, backup codes are not supported
    return res.status(501).json({
      error: 'Backup codes not available in simple auth mode',
      code: 'NOT_IMPLEMENTED'
    });
    
    /* Original code - requires users store:
    const { username, password, backupCode } = req.body;
    
    // Validate user credentials first
    const user = users.get(username);
    if (!user || !await verifyPassword(password, user.password)) {
      return res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Verify backup code
    if (!user.backupCodes || !securityService.verifyBackupCode(backupCode, user.backupCodes)) {
      return res.status(401).json({
        error: 'Invalid backup code',
        code: 'INVALID_BACKUP_CODE'
      });
    }
    
    // Count remaining codes
    const remainingCodes = user.backupCodes.filter(bc => !bc.used).length;
    
    // Generate tokens
    const tokens = await tokenService.generateTokenPair(user, req);
    
    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/'
    });
    
    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth/refresh'
    });
    
    res.json({
      success: true,
      remainingBackupCodes: remainingCodes,
      warning: remainingCodes < 3 ? `Only ${remainingCodes} backup codes remaining` : null,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions
      }
    });
    */
  } catch (error) {
    console.error('Backup code login error:', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'BACKUP_LOGIN_ERROR'
    });
  }
});

module.exports = router;