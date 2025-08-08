# Azure AD Automatic Setup Guide

This guide explains how to use the automatic Azure AD app registration feature for Exchange Online integration.

## Overview

The automatic setup wizard simplifies the Exchange Online configuration process by:

- Automatically creating Azure AD applications
- Configuring required permissions (Mail.Send, User.Read)
- Setting up redirect URIs
- Granting admin consent automatically
- Saving the complete configuration

## Prerequisites

### Administrator Requirements

- **Global Administrator** or **Application Administrator** role in Azure AD
- Access to the target Azure AD tenant
- Permission to register applications in the tenant

### System Requirements

- SMTP Relay Dashboard running
- Network connectivity to Microsoft services
- Modern web browser with JavaScript enabled

## Setup Process

### Step 1: Access the Setup Wizard

1. Navigate to the **Exchange Setup** page in the dashboard
2. Click **"Automatic Setup"** card
3. Review the setup requirements and click **Continue**

### Step 2: Administrator Authentication

1. Click **"Sign in as Global Admin"**
2. You'll be redirected to Microsoft's authentication page
3. Sign in with your Global Administrator account
4. Grant the required permissions when prompted

**Required Permissions:**
- `Application.ReadWrite.All` - Create and manage applications
- `AppRoleAssignment.ReadWrite.All` - Grant permissions
- `Directory.ReadWrite.All` - Read directory information
- `User.Read` - Basic user profile information

### Step 3: Automatic App Registration

The wizard will automatically:

1. **Create Application**: Register a new Azure AD application
2. **Configure Permissions**: Set up Mail.Send (Application) and User.Read (Delegated) permissions
3. **Setup Redirect URIs**: Configure callback URLs for authentication
4. **Generate Secret**: Create a client secret for authentication
5. **Grant Consent**: Automatically grant admin consent for all users
6. **Save Configuration**: Store all settings in the system configuration

### Step 4: Service Account Configuration

1. Enter the email address of the service account that will send emails
2. The wizard will verify the account exists and has Exchange Online access
3. Click **"Configure Service Account"** to proceed

### Step 5: Test and Verify

1. Click **"Test Connection"** to verify the configuration
2. The system will attempt to authenticate and access Microsoft Graph
3. Review the test results and ensure all permissions are working

### Step 6: Complete Setup

Once all tests pass, click **"Complete Setup"** to finalize the configuration.

## Configuration Details

### Generated Application Settings

The wizard creates an Azure AD application with these settings:

```yaml
exchange_online:
  host: smtp.office365.com
  port: 587
  secure: false
  auth:
    method: device_code
    tenant_id: [your-tenant-id]
    client_id: [generated-client-id]
    client_secret: [generated-secret]
  api_method: graph_api
  auto_configured: true
  configured_at: [timestamp]
```

### Application Permissions

**Microsoft Graph API Permissions:**
- `User.Read` (Delegated) - Read basic user profile
- `Mail.Send` (Application) - Send emails as any user

**Application Settings:**
- **Display Name**: "SMTP Relay for Exchange Online"
- **Sign-in Audience**: Single tenant
- **Redirect URIs**: Configured for your dashboard URL

## Troubleshooting

### Common Issues

#### 1. "Insufficient Privileges" Error

**Cause**: Account lacks Global Administrator or Application Administrator role

**Solution**: 
- Verify you have the correct administrator role
- Contact your tenant administrator to grant required permissions
- Ensure your account can register applications in Azure AD

#### 2. "Application Already Exists" Error

**Cause**: An application with the same name already exists

**Solutions**:
- Use the manual setup option with existing application details
- Delete the existing application and retry automatic setup
- Modify the application name in advanced settings

#### 3. "Service Account Not Found" Error

**Cause**: Specified service account doesn't exist or lacks Exchange Online license

**Solutions**:
- Verify the email address is correct
- Ensure the account has an Exchange Online license
- Check that the account is not disabled

#### 4. "Network Connectivity" Errors

**Cause**: Cannot reach Microsoft services

**Solutions**:
- Check internet connectivity
- Verify corporate firewall allows access to Microsoft services
- Try from a different network or browser

#### 5. "Token Expired" Error

**Cause**: Admin authentication token has expired

**Solutions**:
- Restart the setup process
- Ensure you complete setup within the token validity period
- Clear browser cache and cookies

### Advanced Troubleshooting

#### Enable Debug Logging

Set environment variable for detailed logging:
```bash
export AZURE_DEBUG=true
```

#### Manual Permission Grant

If automatic consent fails, manually grant permissions:

1. Go to Azure Portal > Azure AD > App Registrations
2. Find your application
3. Go to API Permissions
4. Click "Grant admin consent for [tenant]"

#### Verify Application Configuration

Check the created application in Azure Portal:

1. Navigate to **Azure Active Directory** > **App Registrations**
2. Find the application named "SMTP Relay for Exchange Online"
3. Verify:
   - API Permissions are granted
   - Client secret is configured
   - Redirect URIs are set correctly

## Security Considerations

### Admin Token Security

- Admin tokens are stored temporarily in secure session storage
- Tokens are automatically cleaned up after use
- Sessions expire after inactivity

### Application Security

- Client secrets have 1-year expiration
- Application uses secure OAuth 2.0 flows
- Permissions follow principle of least privilege

### Network Security

- All communication uses HTTPS/TLS
- No sensitive data is logged
- Tokens are never stored in client-side storage

## Environment Variables

Configure these environment variables for admin authentication:

```bash
# Admin application credentials (for automatic setup)
AZURE_ADMIN_CLIENT_ID=your-admin-app-client-id
AZURE_ADMIN_CLIENT_SECRET=your-admin-app-secret
AZURE_TENANT_ID=your-tenant-id

# Optional: Enable debug logging
AZURE_DEBUG=true
```

## Manual Setup Alternative

If automatic setup doesn't work for your environment, use the manual setup option:

1. Manually create Azure AD application
2. Configure permissions and redirect URIs
3. Generate client secret
4. Use the manual setup wizard with these details

## Support and Resources

### Microsoft Documentation

- [Azure AD App Registration](https://docs.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [Microsoft Graph Permissions](https://docs.microsoft.com/en-us/graph/permissions-reference)
- [OAuth 2.0 Device Code Flow](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code)

### SMTP Relay Resources

- Check the dashboard logs for detailed error information
- Review the existing Exchange Setup documentation
- Contact your system administrator for Azure AD access

## Conclusion

The automatic setup wizard significantly simplifies Exchange Online configuration by handling all the complex Azure AD setup steps automatically. For most environments with proper administrator access, this should be the preferred setup method.

If you encounter issues, start with the troubleshooting section and consider using the manual setup as an alternative.