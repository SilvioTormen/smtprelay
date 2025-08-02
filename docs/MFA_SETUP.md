# Multi-Factor Authentication (MFA) Setup Guide

## Overview
The SMTP Relay Dashboard supports multiple MFA methods for enhanced security:
- **TOTP** (Microsoft Authenticator, Google Authenticator)
- **FIDO2/WebAuthn** (YubiKey, Security Keys)
- **Backup Codes** (Recovery codes)

## 1. Microsoft Authenticator Setup

### Prerequisites
- Install Microsoft Authenticator on your phone
- Alternative: Google Authenticator, Authy, or any TOTP app

### Setup Steps
1. Login to the dashboard
2. Navigate to **Settings → Security**
3. Click **"Setup Microsoft Authenticator"**
4. Scan the QR code with your authenticator app
5. Enter the 6-digit code to verify
6. Save the backup codes provided

### Manual Setup (if QR scan fails)
1. Open Microsoft Authenticator
2. Tap "+" → "Work or school account"
3. Choose "Enter code manually"
4. Enter:
   - Account name: `SMTP Relay (your-username)`
   - Secret key: Displayed on screen
5. Tap "Finish"

## 2. YubiKey / FIDO2 Setup

### Supported Devices
- YubiKey 5 Series (USB-A, USB-C, NFC)
- YubiKey Bio Series
- YubiKey Security Key
- Google Titan Security Key
- Other FIDO2-certified keys

### Setup Steps
1. Login to the dashboard
2. Navigate to **Settings → Security → Security Keys**
3. Insert your YubiKey into USB port
4. Click **"Add Security Key"**
5. Enter a name for the key (optional)
6. When prompted by browser:
   - Touch the YubiKey button (gold contact)
   - Enter PIN if configured
7. Key is now registered

### Browser Requirements
- Chrome 67+
- Firefox 60+
- Edge 18+
- Safari 14+

## 3. Backup Codes

### When to Use
- Lost access to authenticator app
- YubiKey not available
- Emergency access needed

### Setup
1. Automatically generated when setting up first MFA method
2. To regenerate: **Settings → Security → Backup Codes → Generate New**

### Important Notes
- Each code can only be used ONCE
- Store codes in a secure location (password manager, safe)
- Regenerating invalidates all previous codes
- You'll be warned when running low on codes

## 4. Using MFA

### During Login
1. Enter username and password
2. Choose MFA method:
   - **Authenticator**: Enter 6-digit code
   - **Security Key**: Insert and touch key
   - **Backup Code**: Enter one recovery code

### API Access with MFA
```javascript
// After initial authentication
headers: {
  'Authorization': 'Bearer <jwt-token>',
  'X-MFA-Token': 'totp:123456'  // For TOTP
  // OR
  'X-MFA-Token': 'fido2:<credential-id>'  // For YubiKey
  // OR
  'X-MFA-Token': 'backup:1234-5678'  // For backup code
}
```

## 5. Security Best Practices

### Recommended Setup
1. **Primary**: YubiKey (most secure)
2. **Backup**: Microsoft Authenticator
3. **Emergency**: Backup codes (printed/secured)

### Tips
- Use different MFA methods on different devices
- Register multiple YubiKeys (one for backup)
- Test backup codes periodically
- Update MFA when changing phones

## 6. Troubleshooting

### TOTP Code Not Working
- Check device time is synced
- Try previous/next code (30-second window)
- Ensure correct authenticator account selected

### YubiKey Not Detected
- Try different USB port
- Check browser compatibility
- Ensure FIDO2 is enabled on key
- Update browser to latest version

### Account Locked
- 5 failed attempts = 30-minute lockout
- Contact admin for immediate unlock
- Use backup codes if available

## 7. Admin Configuration

### Enable MFA Enforcement
```javascript
// In user configuration
{
  "mfaEnforced": true,
  "mfaGracePeriod": 7  // days
}
```

### Disable MFA for User (Emergency)
```bash
# Via API with admin token
POST /api/admin/users/{userId}/disable-mfa
```

## 8. Compliance

### Standards Met
- NIST 800-63B (Authentication Guidelines)
- FIDO2 / WebAuthn W3C Standard
- RFC 6238 (TOTP)
- PCI DSS MFA Requirements

### Audit Logging
All MFA events are logged:
- MFA setup/removal
- Authentication attempts
- Backup code usage
- Device registration

## Support

For MFA issues, contact your IT administrator with:
- Username
- MFA method attempted
- Error message received
- Time of attempt