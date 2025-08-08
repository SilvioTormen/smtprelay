# Exchange Online Setup Guide

This guide covers the complete setup process for integrating the SMTP Relay with Exchange Online using the automated setup wizard.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Setup Modes](#setup-modes)
- [Quick Start](#quick-start)
- [Detailed Setup Instructions](#detailed-setup-instructions)
- [Configuration Options](#configuration-options)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## Prerequisites

Before starting the setup process, ensure you have:

1. **Microsoft 365 Account**
   - Active Exchange Online subscription
   - Global Administrator access (for admin setup mode)
   - Or Application Administrator access (for simple setup mode)

2. **Azure AD Access**
   - Ability to create app registrations
   - Permissions to grant admin consent

3. **Network Requirements**
   - Outbound HTTPS access to Microsoft services
   - Ports 25, 587, or 465 available for SMTP relay

## Setup Modes

The Exchange setup wizard offers three different modes:

### 1. Simple Setup (Recommended for Most Users)
- **Best for**: Basic email relay needs
- **Requirements**: Application Administrator role
- **What it does**:
  - Creates Azure AD app registration
  - Configures basic permissions
  - Requires manual admin consent

### 2. Admin Setup (Fully Automated)
- **Best for**: Enterprise deployments
- **Requirements**: Global Administrator credentials
- **What it does**:
  - Automatically creates app registration
  - Configures all permissions
  - Grants admin consent automatically
  - Sets up Exchange connectors
  - Configures mail flow rules

### 3. Manual Setup (Advanced Users)
- **Best for**: Custom configurations
- **Requirements**: Existing Azure AD app registration
- **What it does**:
  - Uses your existing app registration
  - Allows custom permission configuration
  - Full control over setup process

## Quick Start

### Option 1: Web Dashboard Setup

1. Access the dashboard:
   ```bash
   https://your-server:3001
   ```

2. Navigate to **Settings** → **Exchange Setup**

3. Click **Start Setup Wizard**

4. Follow the on-screen instructions

### Option 2: Command Line Setup

```bash
# Run the automated setup wizard
cd /opt/smtp-relay
sudo -u smtp-relay npm run setup:azure

# Follow the interactive prompts
```

## Detailed Setup Instructions

### Simple Setup Mode

1. **Start the Setup Wizard**
   ```bash
   npm run setup:azure
   ```

2. **Select "Simple Setup"** when prompted

3. **Provide Required Information**:
   - Tenant ID (found in Azure Portal → Azure Active Directory)
   - Display name for the app registration
   - Your email address for notifications

4. **Review Permissions**:
   The wizard will request:
   - `Mail.Send` - Send emails on behalf of users
   - `offline_access` - Maintain access when users are not signed in

5. **Grant Admin Consent**:
   - The wizard will provide a URL
   - Open the URL in a browser
   - Sign in as Global Administrator
   - Grant consent for your organization

6. **Complete Authentication**:
   - Return to the wizard
   - Enter the authorization code
   - Setup complete!

### Admin Setup Mode

1. **Start the Setup Wizard**
   ```bash
   npm run setup:azure
   ```

2. **Select "Admin Setup"**

3. **Provide Administrator Credentials**:
   ```
   Enter Global Admin email: admin@yourdomain.com
   Enter password: ********
   ```

4. **Automatic Configuration**:
   The wizard will automatically:
   - Create app registration
   - Configure API permissions
   - Grant admin consent
   - Create Exchange connector
   - Configure mail flow rules
   - Generate client credentials

5. **Review Configuration**:
   ```
   ✅ App Registration: smtp-relay-app
   ✅ Client ID: xxxx-xxxx-xxxx-xxxx
   ✅ Permissions: Mail.Send, SMTP.Send
   ✅ Connector: SMTP-Relay-Connector
   ✅ Mail Flow: Configured
   ```

### Manual Setup Mode

1. **Create App Registration in Azure Portal**:
   - Go to Azure Portal → Azure Active Directory
   - Navigate to App registrations → New registration
   - Name: `SMTP Relay Service`
   - Supported account types: `Single tenant`

2. **Configure API Permissions**:
   - Add permission → Microsoft Graph → Application permissions
   - Select `Mail.Send`
   - Grant admin consent

3. **Create Client Secret**:
   - Certificates & secrets → New client secret
   - Description: `SMTP Relay Secret`
   - Copy the secret value immediately

4. **Run Manual Setup**:
   ```bash
   npm run setup:azure
   # Select "Manual Setup"
   # Enter:
   # - Tenant ID
   # - Client ID
   # - Client Secret
   ```

## Configuration Options

### Exchange Connector Settings

The setup wizard can configure Exchange connectors with these options:

```yaml
exchange_connector:
  name: "SMTP-Relay-Connector"
  type: "Partner"
  settings:
    smart_hosts:
      - "smtp.office365.com"
    tls_settings:
      require_tls: true
      tls_version: "TLS1.2"
    authentication:
      type: "OAuth2"
    restrictions:
      allowed_senders:
        - "*@yourdomain.com"
      message_size_limit: "35MB"
```

### Mail Flow Rules

Automatic mail flow rule configuration:

```yaml
mail_flow_rules:
  - name: "Allow SMTP Relay"
    priority: 1
    conditions:
      sender_ip_ranges:
        - "Your public IP"
    actions:
      bypass_spam_filtering: false
      set_scl: -1
```

### Security Settings

```yaml
security:
  token_lifetime: 3600
  refresh_token_lifetime: 86400
  allowed_domains:
    - "yourdomain.com"
  ip_restrictions:
    enabled: true
    allowed_ips:
      - "192.168.1.0/24"
```

## Troubleshooting

### Common Issues and Solutions

#### 1. "Insufficient privileges" Error
**Problem**: User doesn't have required Azure AD permissions
**Solution**: 
- Ensure you have Global Administrator or Application Administrator role
- Use `az role assignment list --assignee <your-email>` to check roles

#### 2. "App registration failed"
**Problem**: Cannot create app registration
**Solution**:
```bash
# Check Azure AD permissions
az ad app list --display-name "SMTP Relay" --query "[].{Name:displayName, ID:appId}"

# Manually create if needed
az ad app create --display-name "SMTP Relay Service"
```

#### 3. "Token acquisition failed"
**Problem**: Cannot obtain access token
**Solution**:
```bash
# Clear token cache
rm /opt/smtp-relay/.tokens.json

# Re-run authentication
npm run setup:auth
```

#### 4. "Connector creation failed"
**Problem**: Cannot create Exchange connector
**Solution**:
- Verify Exchange Online PowerShell module is installed
- Check Exchange administrator permissions
- Try manual connector creation in Exchange Admin Center

### Verification Commands

Check setup status:
```bash
# Verify app registration
npm run verify:azure

# Test Exchange connection
npm run test:exchange

# Check token status
npm run token:status
```

## Security Considerations

### Token Storage
- Tokens are stored in `.tokens.json` with 600 permissions
- Automatically encrypted at rest
- Refresh tokens rotate on each use

### Access Control
- Implement IP whitelisting for production
- Use conditional access policies in Azure AD
- Enable audit logging for all operations

### Best Practices
1. **Use Service Principals** instead of user credentials when possible
2. **Rotate secrets regularly** - Every 90 days recommended
3. **Monitor usage** through Azure AD sign-in logs
4. **Implement least privilege** - Only grant required permissions
5. **Enable MFA** for all administrator accounts

### Compliance
- Ensure compliance with your organization's security policies
- Review audit logs regularly
- Implement data retention policies
- Consider geographic restrictions for data residency

## Advanced Configuration

### Using Microsoft Graph API

For enhanced functionality, configure Graph API:

```javascript
// config/exchange.js
module.exports = {
  api_method: 'graph_api',
  graph_config: {
    endpoint: 'https://graph.microsoft.com/v1.0',
    scopes: ['https://graph.microsoft.com/.default'],
    batch_size: 20,
    retry_attempts: 3
  }
};
```

### Custom Authentication Flow

Implement custom authentication:

```javascript
// services/customAuth.js
const { ConfidentialClientApplication } = require('@azure/msal-node');

const msalConfig = {
  auth: {
    clientId: process.env.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
    clientSecret: process.env.CLIENT_SECRET
  }
};

const cca = new ConfidentialClientApplication(msalConfig);
```

### Monitoring and Logging

Enable detailed logging:

```yaml
logging:
  level: "debug"
  exchange_operations: true
  token_refresh: true
  api_calls: true
  output:
    file: "/var/log/smtp-relay/exchange.log"
    console: true
```

## Support

For additional help:
- Check the [FAQ](./FAQ.md)
- Review [Azure Auto Setup Guide](./AZURE_AUTO_SETUP.md)
- Open an issue on [GitHub](https://github.com/SilvioTormen/smtprelay/issues)
- Consult Microsoft's [Exchange Online documentation](https://docs.microsoft.com/en-us/exchange/exchange-online)