const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth');
const {
  TOTPManager,
  FIDO2Manager,
  BackupCodesManager,
  requireMFA,
} = require('../middleware/mfa');

const router = express.Router();

// All MFA routes require authentication
router.use(authenticate);

/**
 * Get MFA status for current user
 */
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's MFA configuration
    const user = require('../middleware/auth').users.get(req.user.username);
    
    const status = {
      totp: {
        enabled: user?.totpEnabled || false,
        configured: !!user?.totpSecret,
      },
      fido2: {
        enabled: user?.fido2Enabled || false,
        devices: FIDO2Manager.getDevices(userId),
      },
      backup: {
        enabled: true, // Always available as fallback
        remaining: BackupCodesManager.getRemainingCount(userId),
      },
      enforced: user?.mfaEnforced || false,
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
router.post('/totp/setup', async (req, res) => {
  try {
    const username = req.user.username;
    const user = require('../middleware/auth').users.get(username);
    
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Generate new TOTP secret
    const totpData = TOTPManager.generateSecret(username);
    
    // Generate QR code for Microsoft Authenticator
    const qrData = await TOTPManager.generateQRCode(username, totpData.secret);
    
    // Store secret temporarily (not enabled until verified)
    user.totpSecretTemp = totpData.secret;

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
    console.error('TOTP setup error:', error);
    res.status(500).json({
      error: 'Failed to setup TOTP',
      code: 'TOTP_SETUP_ERROR',
    });
  }
});

/**
 * Verify and enable TOTP
 */
router.post('/totp/verify',
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

      const username = req.user.username;
      const user = require('../middleware/auth').users.get(username);
      
      if (!user?.totpSecretTemp) {
        return res.status(400).json({
          error: 'TOTP setup not initiated',
          code: 'TOTP_NOT_SETUP',
        });
      }

      // Verify the token
      const isValid = TOTPManager.verifyToken(user.totpSecretTemp, req.body.token);
      
      if (isValid) {
        // Enable TOTP
        user.totpSecret = user.totpSecretTemp;
        user.totpEnabled = true;
        delete user.totpSecretTemp;
        
        // Generate backup codes if first MFA method
        if (!user.backupCodes) {
          const codes = BackupCodesManager.generateCodes(req.user.id);
          user.backupCodes = true;
          
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
  requireMFA,
  async (req, res) => {
    try {
      const username = req.user.username;
      const user = require('../middleware/auth').users.get(username);
      
      if (!user?.totpEnabled) {
        return res.status(400).json({
          error: 'TOTP not enabled',
          code: 'TOTP_NOT_ENABLED',
        });
      }

      // Check if user has other MFA methods
      const hasFido2 = FIDO2Manager.getDevices(req.user.id).length > 0;
      if (!hasFido2) {
        return res.status(400).json({
          error: 'Cannot disable last MFA method',
          code: 'LAST_MFA_METHOD',
          hint: 'Enable another MFA method before disabling TOTP',
        });
      }

      user.totpEnabled = false;
      delete user.totpSecret;

      res.json({
        success: true,
        message: 'TOTP disabled successfully',
      });
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
router.post('/fido2/register/begin', async (req, res) => {
  try {
    const options = await FIDO2Manager.generateRegistration(
      req.user.id,
      req.user.username,
      req.user.username
    );

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
    console.error('FIDO2 registration begin error:', error);
    res.status(500).json({
      error: 'Failed to start FIDO2 registration',
      code: 'FIDO2_REG_BEGIN_ERROR',
    });
  }
});

/**
 * FIDO2/WebAuthn - Complete registration
 */
router.post('/fido2/register/complete', async (req, res) => {
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
        FIDO2Manager.renameDevice(req.user.id, result.credentialID, deviceName);
      }

      // Enable FIDO2 for user
      const user = require('../middleware/auth').users.get(req.user.username);
      if (user) {
        user.fido2Enabled = true;
      }

      // Clean up session
      delete req.session.fido2Registration;

      // Generate backup codes if first MFA method
      if (!user.backupCodes) {
        const codes = BackupCodesManager.generateCodes(req.user.id);
        user.backupCodes = true;
        
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
    const options = await FIDO2Manager.generateAuthentication(req.user.id);

    // Store challenge in session
    req.session.fido2Authentication = {
      challenge: options.challenge,
      userId: req.user.id,
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

    const result = await FIDO2Manager.verifyAuthentication(
      req.user.id,
      credential
    );

    if (result.verified) {
      // Mark MFA as verified
      req.session.mfaVerified = true;
      req.session.mfaMethod = 'fido2';
      req.session.fido2Verified = credential.id;

      // Clean up session
      delete req.session.fido2Authentication;

      res.json({
        success: true,
        message: 'Authentication successful',
        mfaToken: `fido2:${credential.id}`, // For subsequent requests
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
router.get('/fido2/devices', async (req, res) => {
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
  requireMFA,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if user has other MFA methods
      const devices = FIDO2Manager.getDevices(req.user.id);
      const user = require('../middleware/auth').users.get(req.user.username);
      
      if (devices.length <= 1 && !user?.totpEnabled) {
        return res.status(400).json({
          error: 'Cannot remove last MFA method',
          code: 'LAST_MFA_METHOD',
        });
      }

      const removed = FIDO2Manager.removeDevice(req.user.id, id);
      
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
  requireMFA,
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
router.get('/backup/status', async (req, res) => {
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