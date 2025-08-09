# Enterprise SMTP Relay for Microsoft 365

A robust, enterprise-grade SMTP relay service designed for legacy devices (printers, scanners, monitoring systems) that need to send emails through Exchange Online/Microsoft 365.

## 🚀 Key Features

### **Multi-Port Support**
- Port 25 (Plain SMTP for legacy devices)
- Port 587 (STARTTLS for modern devices)  
- Port 465 (Implicit TLS for specialized equipment)

### **Legacy Device Compatibility**
- No authentication required for IP whitelist
- Static users for legacy authentication
- Supports old TLS versions (TLS 1.0+)
- Relaxed SMTP for non-compliant devices
- 8-bit MIME support

### **Microsoft 365 Integration**
- OAuth2 Modern Authentication (Device Code, Authorization Code, Client Credentials)
- Microsoft Graph API integration (recommended)
- Automatic token renewal and management

### **Enterprise Security**
- Multi-Factor Authentication (TOTP + FIDO2)
- Device fingerprinting and anomaly detection
- IP whitelisting with CIDR support
- Rate limiting and DDoS protection
- Comprehensive audit logging

## 📋 Requirements

- Node.js 18+ (LTS recommended: v20.x)
- Microsoft 365 with active subscription
- Azure AD App Registration

## 🎯 Quick Start

### ⚡ One-Command Installation

```bash
# Clone and auto-install everything
git clone https://github.com/SilvioTormen/smtprelay.git && cd smtprelay && ./install.sh
```

That's it! The installer will:
- ✅ Install all dependencies
- ✅ Generate security secrets
- ✅ Create default admin user
- ✅ Build the dashboard
- ✅ Start the application

**Access Dashboard:** http://localhost:3001

**Default Login:**
- Username: `admin`
- Password: `admin`

> ⚠️ **IMPORTANT:** Change the default password after first login!

## ⚙️ Configuration

### Default User

The system creates one default admin user on first run:

- **Username:** `admin`
- **Password:** `admin`
- **Role:** Administrator (full access)

> ⚠️ **SECURITY:** Change this password immediately after first login!

### Exchange Online Setup

1. Login to the dashboard as admin
2. Navigate to **Settings → Exchange Setup**
3. Follow the setup wizard to configure Azure AD

### Legacy Device Configuration

Edit `config.yml` to configure device access:

```yaml
# IP whitelist for no-auth devices
ip_whitelist:
  no_auth_required:
    - "192.168.1.0/24"  # Printer VLAN
    - "10.0.50.0/24"    # IoT devices
    
# Static users for legacy auth
legacy_auth:
  static_users:
    - username: "scanner"
      password: "SecurePassword2024!"
      allowed_ips: ["192.168.1.0/24"]
```

## 🔍 Management & Monitoring

### Web Dashboard
- **URL**: `http://localhost:3001`
- **Features**: 
  - Real-time statistics
  - Device management
  - Queue monitoring
  - Exchange configuration
  - User management
  - Security logs

### Service Management

```bash
# Using PM2 (recommended)
pm2 status smtp-relay
pm2 restart smtp-relay
pm2 logs smtp-relay

# View logs
tail -f logs/smtp-relay.log

# Check status
npm run status
```

## 📊 Typical Device Configurations

| Device Type | Port | Auth | TLS |
|------------|------|------|-----|
| Old Printers | 25 | No | No |
| Modern Printers | 587 | Optional | STARTTLS |
| NAS Systems | 587 | Yes | STARTTLS |
| Monitoring Tools | 25 | No | Optional |
| Security Cameras | 587 | Yes | STARTTLS |

## 🛠️ Troubleshooting

### Device cannot send emails
```bash
# Check IP whitelist
grep -A5 ip_whitelist config.yml

# Check logs for device IP
grep "192.168.1.100" logs/smtp-relay.log
```

### Exchange authentication failed
```bash
# Check token status
cat .tokens.json | jq .expires_at

# Refresh tokens
npm run refresh-token
```

### Login issues
- Default credentials: admin/admin
- After failed attempts, wait 15 minutes or restart the service
- Check `/data/users.json` exists

## 🔒 Security Notes

- All user passwords are bcrypt hashed
- Tokens are encrypted at rest
- Session data in memory (or Redis if configured)
- MFA can be enabled per user
- Regular security updates via npm audit

## 📚 Documentation

- [Exchange Setup Guide](docs/EXCHANGE_SETUP.md)
- [OAuth2 Setup Guide](docs/OAUTH2_SETUP.md)
- [MFA Setup Guide](docs/MFA_SETUP.md)
- [Security Documentation](SECURITY.md)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## 📄 License

MIT - See [LICENSE](LICENSE)

## 🆘 Support

- Issues: [GitHub Issues](https://github.com/SilvioTormen/smtprelay/issues)
- Security: See [SECURITY.md](SECURITY.md)