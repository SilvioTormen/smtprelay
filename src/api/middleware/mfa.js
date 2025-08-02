const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const base64url = require('base64url');
const OTPAuth = require('otpauth');
const qrcode = require('qrcode');
const cryptoRandomString = require('crypto-random-string');

// Configuration
const RP_NAME = 'SMTP Relay Control Center';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

// In-memory stores (use database in production)
const userCredentials = new Map(); // userId -> credentials[]
const challenges = new Map(); // userId -> challenge
const backupCodes = new Map(); // userId -> codes[]

/**
 * TOTP (Time-based One-Time Password) - Microsoft/Google Authenticator
 */
class TOTPManager {
  /**
   * Generate TOTP secret for user
   * Compatible with Microsoft Authenticator, Google Authenticator, Authy, etc.
   */
  static generateSecret(username, issuer = 'SMTP Relay') {
    // Create TOTP instance
    const totp = new OTPAuth.TOTP({
      issuer: issuer,
      label: username,
      algorithm: 'SHA1', // Most compatible
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(
        base64url.toBase64(cryptoRandomString({ length: 20 }))
          .replace(/=/g, '')
          .toUpperCase()
      ),
    });

    return {
      secret: totp.secret.base32,
      uri: totp.toString(), // otpauth:// URI for QR code
      qrCode: null, // Will be generated async
    };
  }

  /**
   * Generate QR code for Microsoft Authenticator
   * Includes special parameters for Microsoft compatibility
   */
  static async generateQRCode(username, secret, issuer = 'SMTP Relay') {
    const totp = new OTPAuth.TOTP({
      issuer: issuer,
      label: `${issuer} (${username})`, // Microsoft format
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Generate otpauth URI with Microsoft-specific parameters
    const uri = totp.toString();
    
    // Generate QR code with high error correction for better scanning
    const qrCodeDataUrl = await qrcode.toDataURL(uri, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 1,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 256,
    });

    return {
      uri,
      qrCode: qrCodeDataUrl,
      manualEntryKey: secret.match(/.{1,4}/g).join(' '), // Format: XXXX XXXX XXXX
    };
  }

  /**
   * Verify TOTP token
   * Allows for time drift (±1 window)
   */
  static verifyToken(secret, token) {
    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    // Validate with time window for clock skew
    const delta = totp.validate({
      token: token,
      window: 1, // Allow 30 seconds before/after
    });

    return delta !== null; // Returns true if valid
  }
}

/**
 * FIDO2/WebAuthn - YubiKey, Windows Hello, Touch ID, etc.
 */
class FIDO2Manager {
  /**
   * Generate registration options for new FIDO2 device
   */
  static async generateRegistration(userId, username, displayName) {
    // Get existing credentials for this user
    const existingCredentials = userCredentials.get(userId) || [];

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: userId,
      userName: username,
      userDisplayName: displayName || username,
      attestationType: 'direct', // Request attestation for better security
      authenticatorSelection: {
        authenticatorAttachment: 'cross-platform', // Allow YubiKey
        userVerification: 'preferred', // Prefer PIN/biometric
        requireResidentKey: false,
        residentKey: 'discouraged', // For broader compatibility
      },
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: cred.transports,
      })),
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
      timeout: 60000, // 60 seconds
    });

    // Store challenge for verification
    challenges.set(userId, options.challenge);

    return options;
  }

  /**
   * Verify registration response from client
   */
  static async verifyRegistration(userId, response) {
    const expectedChallenge = challenges.get(userId);
    if (!expectedChallenge) {
      throw new Error('No challenge found for user');
    }

    try {
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        requireUserVerification: false, // For broader compatibility
      });

      if (verification.verified && verification.registrationInfo) {
        const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = 
          verification.registrationInfo;

        // Store credential
        const credentials = userCredentials.get(userId) || [];
        credentials.push({
          credentialID: base64url.encode(credentialID),
          publicKey: base64url.encode(credentialPublicKey),
          counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: response.response.transports || ['usb', 'nfc', 'ble'],
          registered: new Date().toISOString(),
          lastUsed: null,
          name: `Security Key ${credentials.length + 1}`, // Can be renamed by user
        });
        userCredentials.set(userId, credentials);

        // Clean up challenge
        challenges.delete(userId);

        return {
          verified: true,
          credentialID: base64url.encode(credentialID),
        };
      }

      return { verified: false };
    } catch (error) {
      console.error('Registration verification error:', error);
      throw error;
    }
  }

  /**
   * Generate authentication options for FIDO2
   */
  static async generateAuthentication(userId) {
    const credentials = userCredentials.get(userId) || [];
    
    if (credentials.length === 0) {
      throw new Error('No registered devices for user');
    }

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'preferred',
      allowCredentials: credentials.map(cred => ({
        id: base64url.toBuffer(cred.credentialID),
        type: 'public-key',
        transports: cred.transports,
      })),
      timeout: 60000,
    });

    // Store challenge
    challenges.set(userId, options.challenge);

    return options;
  }

  /**
   * Verify authentication response
   */
  static async verifyAuthentication(userId, response) {
    const expectedChallenge = challenges.get(userId);
    if (!expectedChallenge) {
      throw new Error('No challenge found');
    }

    const credentials = userCredentials.get(userId) || [];
    const credential = credentials.find(
      cred => cred.credentialID === response.id
    );

    if (!credential) {
      throw new Error('Credential not found');
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: ORIGIN,
        expectedRPID: RP_ID,
        authenticator: {
          credentialPublicKey: base64url.toBuffer(credential.publicKey),
          credentialID: base64url.toBuffer(credential.credentialID),
          counter: credential.counter,
        },
        requireUserVerification: false,
      });

      if (verification.verified) {
        // Update counter and last used
        credential.counter = verification.authenticationInfo.newCounter;
        credential.lastUsed = new Date().toISOString();
        
        // Clean up challenge
        challenges.delete(userId);
      }

      return verification;
    } catch (error) {
      console.error('Authentication verification error:', error);
      throw error;
    }
  }

  /**
   * List registered devices for user
   */
  static getDevices(userId) {
    const credentials = userCredentials.get(userId) || [];
    return credentials.map(cred => ({
      id: cred.credentialID,
      name: cred.name,
      deviceType: cred.deviceType,
      registered: cred.registered,
      lastUsed: cred.lastUsed,
      backedUp: cred.backedUp,
    }));
  }

  /**
   * Remove a device
   */
  static removeDevice(userId, credentialId) {
    const credentials = userCredentials.get(userId) || [];
    const filtered = credentials.filter(cred => cred.credentialID !== credentialId);
    userCredentials.set(userId, filtered);
    return filtered.length < credentials.length;
  }

  /**
   * Rename a device
   */
  static renameDevice(userId, credentialId, newName) {
    const credentials = userCredentials.get(userId) || [];
    const credential = credentials.find(cred => cred.credentialID === credentialId);
    if (credential) {
      credential.name = newName;
      return true;
    }
    return false;
  }
}

/**
 * Backup Codes - Recovery codes when other methods unavailable
 */
class BackupCodesManager {
  /**
   * Generate backup codes
   */
  static generateCodes(userId, count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push({
        code: `${cryptoRandomString({ length: 4, type: 'numeric' })}-${cryptoRandomString({ length: 4, type: 'numeric' })}`,
        used: false,
        created: new Date().toISOString(),
      });
    }
    backupCodes.set(userId, codes);
    return codes.map(c => c.code);
  }

  /**
   * Verify backup code
   */
  static verifyCode(userId, code) {
    const codes = backupCodes.get(userId) || [];
    const backupCode = codes.find(c => c.code === code && !c.used);
    
    if (backupCode) {
      backupCode.used = true;
      backupCode.usedAt = new Date().toISOString();
      return true;
    }
    
    return false;
  }

  /**
   * Get remaining codes count
   */
  static getRemainingCount(userId) {
    const codes = backupCodes.get(userId) || [];
    return codes.filter(c => !c.used).length;
  }

  /**
   * Regenerate codes (invalidates old ones)
   */
  static regenerateCodes(userId, count = 10) {
    return this.generateCodes(userId, count);
  }
}

/**
 * Multi-Factor Authentication Middleware
 */
const requireMFA = async (req, res, next) => {
  // Check if MFA is already verified in session
  if (req.session?.mfaVerified) {
    return next();
  }

  // Check for MFA token in header
  const mfaToken = req.headers['x-mfa-token'];
  if (!mfaToken) {
    return res.status(403).json({
      error: 'MFA verification required',
      code: 'MFA_REQUIRED',
      methods: ['totp', 'fido2', 'backup'],
    });
  }

  // Verify MFA token (simplified - use proper JWT in production)
  try {
    const [method, token] = mfaToken.split(':');
    const userId = req.user.id;
    let verified = false;

    switch (method) {
      case 'totp':
        // Verify TOTP
        const user = require('./auth').users.get(req.user.username);
        if (user?.totpSecret) {
          verified = TOTPManager.verifyToken(user.totpSecret, token);
        }
        break;
        
      case 'fido2':
        // FIDO2 verification handled separately
        verified = req.session?.fido2Verified === token;
        break;
        
      case 'backup':
        // Verify backup code
        verified = BackupCodesManager.verifyCode(userId, token);
        if (verified) {
          const remaining = BackupCodesManager.getRemainingCount(userId);
          if (remaining <= 3) {
            res.setHeader('X-Backup-Codes-Warning', `Only ${remaining} backup codes remaining`);
          }
        }
        break;
    }

    if (verified) {
      req.session.mfaVerified = true;
      req.session.mfaMethod = method;
      next();
    } else {
      res.status(401).json({
        error: 'Invalid MFA token',
        code: 'INVALID_MFA',
      });
    }
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({
      error: 'MFA verification failed',
      code: 'MFA_ERROR',
    });
  }
};

module.exports = {
  TOTPManager,
  FIDO2Manager,
  BackupCodesManager,
  requireMFA,
};