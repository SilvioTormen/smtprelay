# OAuth2 Authentication Setup Guide

This guide explains how to configure OAuth2 authentication for the SMTP Relay to work with Exchange Online/Microsoft 365.

## 📋 Table of Contents

1. [Azure AD App Registration](#azure-ad-app-registration)
2. [Authentication Methods](#authentication-methods)
3. [Quick Setup Wizard](#quick-setup-wizard)
4. [Manual Configuration](#manual-configuration)
5. [Testing Authentication](#testing-authentication)
6. [Troubleshooting](#troubleshooting)

## 🔐 Azure AD App Registration

Before configuring the SMTP Relay, you need to create an Azure AD App Registration.

### Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - **Name**: `SMTP Relay Service`
   - **Supported account types**: Choose based on your needs
   - **Redirect URI**: (Configure based on auth method - see below)

### Step 2: Configure API Permissions

#### For Device Code Flow (Recommended for servers):
1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph**
3. Choose **Delegated permissions**
4. Add:
   - `Mail.Send` - Send mail as signed-in user
   - `SMTP.Send` - Send mail via SMTP
   - `offline_access` - Maintain access (refresh tokens)
5. Grant admin consent (if required)

#### For Client Credentials Flow (Service accounts):
1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph**
3. Choose **Application permissions**
4. Add:
   - `Mail.Send` - Send mail as any user
5. **Grant admin consent** (required)

#### For Authorization Code Flow (Web dashboard):
1. Go to **API permissions** → **Add a permission**
2. Select **Microsoft Graph**
3. Choose **Delegated permissions**
4. Add:
   - `Mail.Send` - Send mail as signed-in user
   - `User.Read` - Read user profile
   - `offline_access` - Maintain access
5. Grant admin consent (if required)

### Step 3: Configure Authentication

#### For Device Code Flow:
1. Go to **Authentication**
2. Under **Advanced settings**:
   - Enable **Allow public client flows**: Yes
3. Save changes

#### For Client Credentials Flow:
1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add description and expiry
4. **Copy the secret value immediately** (won't be shown again)

#### For Authorization Code Flow:
1. Go to **Authentication**
2. Add platform → **Web**
3. Add Redirect URI: `http://localhost:3001/api/auth/callback`
4. Configure:
   - Access tokens: ✓
   - ID tokens: ✓
5. Save changes

## 🚀 Authentication Methods

### 1. Device Code Flow (Recommended for Servers)

**Best for:** Headless servers, Docker containers, VMs without browser

**How it works:**
1. Server displays a code (e.g., `ABCD-1234`)
2. Admin goes to `microsoft.com/devicelogin` on any device
3. Enters the code and authenticates
4. Server receives tokens automatically

**Advantages:**
- ✅ No browser needed on server
- ✅ One-time setup
- ✅ Automatic token refresh
- ✅ User delegated permissions

### 2. Client Credentials Flow (For Automation)

**Best for:** Fully automated services, scheduled tasks

**How it works:**
1. Application authenticates directly with client ID + secret
2. No user interaction required
3. Acts with application permissions

**Advantages:**
- ✅ Fully automated
- ✅ No user interaction
- ✅ Can send as any user

**Disadvantages:**
- ⚠️ Requires admin consent
- ⚠️ Higher security risk
- ⚠️ Requires secure secret storage

### 3. Authorization Code Flow (For Web Apps)

**Best for:** Web dashboard, interactive applications

**How it works:**
1. User clicks "Login with Microsoft"
2. Redirected to Microsoft login
3. Grants permissions
4. Redirected back with authorization code
5. Code exchanged for tokens

**Advantages:**
- ✅ Familiar user experience
- ✅ User-specific permissions
- ✅ Supports MFA

## 🧙 Quick Setup Wizard

The easiest way to configure authentication:

```bash
npm run setup:auth
```

The wizard will:
1. Guide you through choosing an auth method
2. Help configure Azure AD settings
3. Test the authentication
4. Save the configuration

### Example Device Code Setup:

```bash
$ npm run setup:auth

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 SMTP RELAY OAUTH2 SETUP WIZARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Choose Authentication Method:
1. Device Code Flow (Recommended for server setup)
2. Client Credentials Flow (For automated services)
3. Authorization Code Flow (For web dashboard)

Enter your choice (1-3): 1

🔐 Azure AD Configuration:
Tenant ID (or "common" for multi-tenant): your-tenant-id
Client ID (Application ID): your-client-id

📱 Device Code Flow Setup:
Ready to authenticate? (y/n): y

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔐 DEVICE CODE AUTHENTICATION REQUIRED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To authenticate, follow these steps:

1. Open your browser and go to: https://microsoft.com/devicelogin
2. Enter this code: ABCD-1234
3. Sign in with your Microsoft 365 account
4. Grant permissions to the SMTP Relay application

Waiting for authentication...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Authentication successful!
✅ Setup completed successfully!
```

## ⚙️ Manual Configuration

### Device Code Flow Configuration

Edit `config.yml`:

```yaml
exchange_online:
  auth:
    method: "device_code"
    tenant_id: "your-tenant-id"  # Or "common"
    client_id: "your-app-client-id"
    send_as: "relay@yourdomain.com"  # Optional default sender
```

First-time authentication:
```bash
# Start the relay - it will prompt for device code auth
npm start
```

### Client Credentials Flow Configuration

Edit `config.yml`:

```yaml
exchange_online:
  auth:
    method: "client_credentials"
    tenant_id: "your-tenant-id"
    client_id: "your-app-client-id"
    client_secret: "your-client-secret"
    send_as: "relay@yourdomain.com"  # Required
```

### Authorization Code Flow Configuration

Edit `config.yml`:

```yaml
exchange_online:
  auth:
    method: "authorization_code"
    tenant_id: "your-tenant-id"
    client_id: "your-app-client-id"
    client_secret: "your-client-secret"  # Optional
    redirect_uri: "http://localhost:3001/api/auth/callback"
```

## 🧪 Testing Authentication

### Test Device Code Flow:
```bash
# Run setup wizard in test mode
npm run setup:auth

# Or manually test
node -e "
const { OAuth2FlowManager } = require('./src/auth/oauth2-flows');
const config = require('yaml').parse(require('fs').readFileSync('./config.yml', 'utf8'));
const manager = new OAuth2FlowManager(config.exchange_online, console);
manager.initializeDeviceCodeFlow().then(console.log).catch(console.error);
"
```

### Test Sending Email:
```bash
# After authentication, test SMTP
telnet localhost 25
EHLO test
MAIL FROM: <test@internal.local>
RCPT TO: <user@yourdomain.com>
DATA
Subject: OAuth2 Test
This is a test email using OAuth2 authentication.
.
QUIT
```

## 🔧 Troubleshooting

### Common Issues

#### "AADSTS50011: Redirect URI mismatch"
- Ensure redirect URI in Azure AD matches exactly with config
- Check for trailing slashes
- Verify protocol (http vs https)

#### "AADSTS65001: User or admin has not consented"
- Grant admin consent in Azure AD
- For delegated permissions, user needs to consent first time

#### "AADSTS700016: Invalid client_id or client_secret"
- Verify client ID in Azure AD
- Regenerate client secret if needed
- Check for copy-paste errors (spaces, special characters)

#### "Token expired" errors
- Tokens are automatically refreshed
- Check `.tokens.json` file exists and is readable
- Run `npm run setup:auth` to re-authenticate

### Debug Mode

Enable detailed logging:
```yaml
logging:
  level: "debug"
```

Check token status:
```bash
cat .tokens.json | jq '.'
```

Clear tokens and re-authenticate:
```bash
rm .tokens.json
npm run setup:auth
```

## 📚 Additional Resources

- [Microsoft Graph Mail API](https://docs.microsoft.com/en-us/graph/api/resources/mail-api-overview)
- [Azure AD OAuth2 Flows](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
- [SMTP OAuth2 with Exchange Online](https://docs.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth)

## 🆘 Support

If you encounter issues:

1. Check the [Troubleshooting](#troubleshooting) section
2. Enable debug logging
3. Review Azure AD audit logs
4. Check Exchange Online message trace

For Azure AD configuration help, consult your Microsoft 365 administrator.