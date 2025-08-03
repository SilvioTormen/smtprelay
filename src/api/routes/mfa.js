const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const {
  TOTPManager,
  FIDO2Manager,
  BackupCodesManager,
  requireMFA,
} = require('../middleware/mfa');
const mfaService = require('../services/mfaService');
const userService = require('../services/userService');

const router = express.Router();

/**
 * Get MFA status for current user
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's MFA configuration from persistent storage
    // This will return default values for new users
    const mfaData = await mfaService.getUserMFA(userId);
    
    const status = {
      totp: {
        enabled: mfaData.totpEnabled || false,
        configured: !!mfaData.totpSecret,
      },
      fido2: {
        enabled: mfaData.fido2Enabled || false,
        devices: mfaData.fido2Devices || [],
      },
      backup: {
        enabled: true, // Always available as fallback
        remaining: mfaData.backupCodes ? mfaData.backupCodes.filter(c => !c.used).length : 0,
      },
      enforced: mfaData.mfaEnforced || false,
      lastVerified: req.session?.mfaVerified ? new Date().toISOString() : null,
    };

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({
      error: 'Failed to get MFA status',
      code: 'MFA_STATUS_ERROR',
    });
  }
});

/**
 * TOTP Setup - Microsoft/Google Authenticator
 */
router.post('/totp/setup', authenticate, async (req, res) => {
  try {
    const username = req.user.username;
    const userId = req.user.id;
    
    // Generate new TOTP secret
    const totpData = TOTPManager.generateSecret(username);
    
    // Generate QR code for Microsoft Authenticator
    const qrData = await TOTPManager.generateQRCode(username, totpData.secret);
    
    // Store secret temporarily in persistent service (not enabled until verified)
    await mfaService.setUserMFA(userId, {
      totpSecretTemp: totpData.secret
    });

    res.json({
      success: true,
      data: {
        secret: totpData.secret,
        qrCode: qrData.qrCode,
        manualEntryKey: qrData.manualEntryKey,
        uri: qrData.uri,
        instructions: {
          microsoft: [
            '1. Open Microsoft Authenticator app',
            '2. Tap "+" to add account',
            '3. Select "Work or school account"',
            '4. Scan the QR code or enter the manual key',
            '5. Enter the 6-digit code to verify',
          ],
          google: [
            '1. Open Google Authenticator app',
            '2. Tap "+" to add account',
            '3. Select "Scan a QR code"',
            '4. Scan the QR code or enter the manual key',
            '5. Enter the 6-digit code to verify',
          ],
        },
      },
    });
  } catch (error) {
    console.error('TOTP setup error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to setup TOTP: ' + error.message,
      code: 'TOTP_SETUP_ERROR',
      details: error.message
    });
  }
});

/**
 * Verify and enable TOTP
 */
router.post('/totp/verify',
  authenticate,
  [body('token').isNumeric().isLength({ min: 6, max: 6 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid token format',
          details: errors.array(),
        });
      }

      const userId = req.user.id;
      
      // Get user's MFA data
      const mfaData = await mfaService.getUserMFA(userId);
      
      if (!mfaData.totpSecretTemp) {
        return res.status(400).json({
          error: 'TOTP setup not initiated',
          code: 'TOTP_NOT_SETUP',
        });
      }

      // Verify the token
      const isValid = TOTPManager.verifyToken(mfaData.totpSecretTemp, req.body.token);
      
      if (isValid) {
        // Enable TOTP in MFA service
        await mfaService.enableTOTP(userId, mfaData.totpSecretTemp);
        
        // Also update user service to enable TOTP
        await userService.enableTOTP(req.user.username, mfaData.totpSecretTemp);
        
        // Generate backup codes if first MFA method
        if (!mfaData.backupCodes || mfaData.backupCodes.length === 0) {
          const codes = await BackupCodesManager.generateCodes(userId);
          
          res.json({
            success: true,
            message: 'TOTP enabled successfully',
            backupCodes: codes,
            warning: 'Save these backup codes in a safe place. They can be used to access your account if you lose your authenticator.',
          });
        } else {
          res.json({
            success: true,
            message: 'TOTP enabled successfully',
          });
        }
      } else {
        res.status(400).json({
          error: 'Invalid verification code',
          code: 'INVALID_TOKEN',
        });
      }
    } catch (error) {
      console.error('TOTP verify error:', error);
      res.status(500).json({
        error: 'Failed to verify TOTP',
        code: 'TOTP_VERIFY_ERROR',
      });
    }
  }
);

/**
 * Disable TOTP
 */
router.post('/totp/disable',
  authenticate,
  // No requireMFA - authenticated users should be able to disable their own TOTP
  async (req, res) => {
    try {
      const username = req.user.username;
      const userId = req.user.id;
      
      // Check both user service and MFA service for TOTP status
      const user = await userService.getUser(username);
      const mfaData = await mfaService.getUserMFA(userId);
      
      if (!user?.totpEnabled && !mfaData?.totpEnabled) {
        return res.status(400).json({
          error: 'TOTP not enabled',
          code: 'TOTP_NOT_ENABLED',
        });
      }

      // Warning if this is the last MFA method, but allow disabling
      const hasFido2 = mfaData.fido2Devices && mfaData.fido2Devices.length > 0;
      const hasBackupCodes = mfaData.backupCodes && mfaData.backupCodes.filter(c => !c.used).length > 0;
      
      let warning = null;
      if (!hasFido2 && !hasBackupCodes) {
        warning = 'This is your last MFA method. Your account will be less secure without MFA.';
      }

      // Disable TOTP in both services
      await mfaService.disableTOTP(req.user.id);
      await userService.disableTOTP(username);

      const response = {
        success: true,
        message: 'TOTP disabled successfully',
      };
      
      if (warning) {
        response.warning = warning;
      }
      
      res.json(response);
    } catch (error) {
      console.error('TOTP disable error:', error);
      res.status(500).json({
        error: 'Failed to disable TOTP',
        code: 'TOTP_DISABLE_ERROR',
      });
    }
  }
);

/**
 * FIDO2/WebAuthn - Register new device (YubiKey, etc.)
 */
router.post('/fido2/register/begin', authenticate, async (req, res) => {
  try {
    console.log('FIDO2 registration begin for user:', req.user.username, 'with ID:', req.user.id);
    
    const options = await FIDO2Manager.generateRegistration(
      req.user.id,
      req.user.username,
      req.user.username
    );

    console.log('Generated FIDO2 options:', {
      challenge: options.challenge ? 'present' : 'missing',
      rp: options.rp,
      user: options.user ? { id: options.user.id, name: options.user.name } : 'missing'
    });

    // Store options in session
    req.session.fido2Registration = {
      challenge: options.challenge,
      userId: req.user.id,
    };

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('FIDO2 registration begin error:', error.message, error.stack);
    res.status(500).json({
      error: 'Failed to start FIDO2 registration: ' + error.message,
      code: 'FIDO2_REG_BEGIN_ERROR',
      details: error.message
    });
  }
});

/**
 * FIDO2/WebAuthn - Complete registration
 */
router.post('/fido2/register/complete', authenticate, async (req, res) => {
  try {
    const { credential, deviceName } = req.body;
    
    if (!req.session.fido2Registration) {
      return res.status(400).json({
        error: 'Registration not initiated',
        code: 'NO_REGISTRATION',
      });
    }

    const result = await FIDO2Manager.verifyRegistration(
      req.user.id,
      credential
    );

    if (result.verified) {
      // Rename device if name provided
      if (deviceName) {
        await FIDO2Manager.renameDevice(req.user.id, result.credentialID, deviceName);
      }

      // Enable FIDO2 for user in both services
      const mfaData = await mfaService.getUserMFA(req.user.id);
      await mfaService.setUserMFA(req.user.id, { 
        fido2Enabled: true 
      });

      // Clean up session
      delete req.session.fido2Registration;

      // Generate backup codes if first MFA method
      const hasBackupCodes = mfaData.backupCodes && mfaData.backupCodes.length > 0;
      if (!hasBackupCodes) {
        const codes = await BackupCodesManager.generateCodes(req.user.id);
        
        res.json({
          success: true,
          message: 'Security key registered successfully',
          credentialID: result.credentialID,
          backupCodes: codes,
          warning: 'Save these backup codes in a safe place.',
        });
      } else {
        res.json({
          success: true,
          message: 'Security key registered successfully',
          credentialID: result.credentialID,
        });
      }
    } else {
      res.status(400).json({
        error: 'Registration verification failed',
        code: 'VERIFICATION_FAILED',
      });
    }
  } catch (error) {
    console.error('FIDO2 registration complete error:', error);
    res.status(500).json({
      error: 'Failed to complete FIDO2 registration',
      code: 'FIDO2_REG_COMPLETE_ERROR',
    });
  }
});

/**
 * FIDO2/WebAuthn - Start authentication
 */
router.post('/fido2/authenticate/begin', async (req, res) => {
  try {
    console.log('FIDO2 authenticate/begin - req.body:', req.body);
    console.log('FIDO2 authenticate/begin - req.user:', req.user);
    
    // During login, username is passed; otherwise use authenticated user
    let userId;
    if (req.body.username) {
      // Login flow - get user by username
      const userService = require('../services/userService');
      const user = await userService.getUser(req.body.username);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }
      userId = user.id;
    } else if (req.user) {
      // Already authenticated flow
      userId = req.user.id;
    } else {
      console.log('FIDO2 authenticate/begin - No username in body and no authenticated user');
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    const options = await FIDO2Manager.generateAuthentication(userId);

    // Store challenge in session
    req.session.fido2Authentication = {
      challenge: options.challenge,
      userId: userId,
    };

    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('FIDO2 auth begin error:', error);
    res.status(500).json({
      error: 'Failed to start FIDO2 authentication',
      code: 'FIDO2_AUTH_BEGIN_ERROR',
    });
  }
});

/**
 * FIDO2/WebAuthn - Complete authentication
 */
router.post('/fido2/authenticate/complete', async (req, res) => {
  try {
    const { credential } = req.body;
    
    if (!req.session.fido2Authentication) {
      return res.status(400).json({
        error: 'Authentication not initiated',
        code: 'NO_AUTHENTICATION',
      });
    }

    // Use the userId from the session (set during begin)
    const userId = req.session.fido2Authentication.userId;
    
    const result = await FIDO2Manager.verifyAuthentication(
      userId,
      credential
    );

    if (result.verified) {
      // Mark MFA as verified
      req.session.mfaVerified = true;
      req.session.mfaMethod = 'fido2';
      req.session.fido2Verified = credential.id;
      req.session.mfaUserId = userId; // Store userId for login completion

      // Clean up session
      delete req.session.fido2Authentication;

      res.json({
        success: true,
        message: 'Authentication successful',
        mfaToken: 'fido2-verified', // Simple token for login flow
      });
    } else {
      res.status(400).json({
        error: 'Authentication verification failed',
        code: 'AUTH_FAILED',
      });
    }
  } catch (error) {
    console.error('FIDO2 auth complete error:', error);
    res.status(500).json({
      error: 'Failed to complete FIDO2 authentication',
      code: 'FIDO2_AUTH_COMPLETE_ERROR',
    });
  }
});

/**
 * List FIDO2 devices
 */
router.get('/fido2/devices', authenticate, async (req, res) => {
  try {
    const devices = FIDO2Manager.getDevices(req.user.id);
    
    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({
      error: 'Failed to list devices',
      code: 'LIST_DEVICES_ERROR',
    });
  }
});

/**
 * Remove FIDO2 device
 */
router.delete('/fido2/devices/:id',
  authenticate,
  // No requireMFA - authenticated users should be able to manage their own devices
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Optional: Check if user has other MFA methods
      // Commented out to allow users to remove all MFA if they want
      // const devices = await FIDO2Manager.getDevices(req.user.id);
      // const mfaData = await mfaService.getUserMFA(req.user.id);
      // 
      // if (devices.length <= 1 && !mfaData?.totpEnabled) {
      //   return res.status(400).json({
      //     error: 'Cannot remove last MFA method',
      //     code: 'LAST_MFA_METHOD',
      //   });
      // }

      const removed = await FIDO2Manager.removeDevice(req.user.id, id);
      
      if (removed) {
        res.json({
          success: true,
          message: 'Device removed successfully',
        });
      } else {
        res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND',
        });
      }
    } catch (error) {
      console.error('Remove device error:', error);
      res.status(500).json({
        error: 'Failed to remove device',
        code: 'REMOVE_DEVICE_ERROR',
      });
    }
  }
);

/**
 * Rename FIDO2 device
 */
router.put('/fido2/devices/:id',
  [body('name').isString().isLength({ min: 1, max: 50 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Invalid input',
          details: errors.array(),
        });
      }

      const { id } = req.params;
      const { name } = req.body;
      
      const renamed = FIDO2Manager.renameDevice(req.user.id, id, name);
      
      if (renamed) {
        res.json({
          success: true,
          message: 'Device renamed successfully',
        });
      } else {
        res.status(404).json({
          error: 'Device not found',
          code: 'DEVICE_NOT_FOUND',
        });
      }
    } catch (error) {
      console.error('Rename device error:', error);
      res.status(500).json({
        error: 'Failed to rename device',
        code: 'RENAME_DEVICE_ERROR',
      });
    }
  }
);

/**
 * Generate new backup codes
 */
router.post('/backup/generate',
  authenticate,
  // No requireMFA - authenticated users should be able to generate backup codes
  async (req, res) => {
    try {
      const codes = BackupCodesManager.regenerateCodes(req.user.id);
      
      res.json({
        success: true,
        data: {
          codes,
          warning: 'Previous backup codes have been invalidated. Save these new codes in a safe place.',
        },
      });
    } catch (error) {
      console.error('Generate backup codes error:', error);
      res.status(500).json({
        error: 'Failed to generate backup codes',
        code: 'BACKUP_CODES_ERROR',
      });
    }
  }
);

/**
 * Get backup codes status
 */
router.get('/backup/status', authenticate, async (req, res) => {
  try {
    const remaining = BackupCodesManager.getRemainingCount(req.user.id);
    
    res.json({
      success: true,
      data: {
        remaining,
        warning: remaining <= 3 ? 'Low on backup codes. Generate new ones soon.' : null,
      },
    });
  } catch (error) {
    console.error('Backup codes status error:', error);
    res.status(500).json({
      error: 'Failed to get backup codes status',
      code: 'BACKUP_STATUS_ERROR',
    });
  }
});

module.exports = router;