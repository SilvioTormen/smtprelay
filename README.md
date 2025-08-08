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
- **Automated Azure Setup Wizard** - Configure Azure AD app registration in minutes
- **Exchange Configuration Management** - Automated mail flow and connector setup
- OAuth2 Modern Authentication (Device Code, Authorization Code, Client Credentials)
- Microsoft Graph API integration (recommended over SMTP OAuth2)
- Automatic token renewal and management

### **Enterprise Security**
- Multi-Factor Authentication (TOTP + FIDO2)
- Device fingerprinting and anomaly detection
- IP whitelisting with CIDR support
- Rate limiting and DDoS protection
- Comprehensive audit logging
- Security score: 10/10

## 📋 Requirements

- Red Hat Enterprise Linux 8/9/10 or compatible (Rocky Linux, AlmaLinux, CentOS Stream)
- Node.js 18+ (LTS recommended: v20.x)
- Microsoft 365 with active subscription
- Azure AD App Registration (can be automated via setup wizard)
- Redis (optional, for sessions and caching)

## 🎯 Quick Start

### Option 1: Automated Setup with Azure Wizard (Recommended)

```bash
# Clone and install
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay
npm install
npm install --prefix dashboard

# Run the automated setup wizard
npm run setup:azure

# The wizard will:
# - Create Azure AD app registration automatically
# - Configure Exchange Online connectors
# - Set up mail flow rules
# - Generate all required credentials
```

### Option 2: Ansible Deployment (Production)

```bash
# On Ansible control node
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay/ansible

# Configure inventory
cp -r inventory/example inventory/production
vim inventory/production/hosts.yml

# Deploy
ansible-playbook -i inventory/production/hosts.yml deploy.yml --ask-vault-pass
```

[Detailed Ansible Guide](ansible/README.md)

### Option 3: Manual Installation

```bash
# Install Node.js if needed
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Clone and install
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay
npm install
npm install --prefix dashboard

# Create service user
sudo useradd -r -s /bin/false smtp-relay

# Move to /opt
cd ..
sudo mv smtprelay /opt/smtp-relay
sudo chown -R smtp-relay:smtp-relay /opt/smtp-relay

# Setup
cd /opt/smtp-relay
sudo -u smtp-relay npm run setup
sudo ./scripts/post-install.sh

# Install service
sudo cp smtp-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now smtp-relay
```

## ⚙️ Configuration

### Azure AD / Exchange Setup

The new automated setup wizard handles everything:

```bash
# Interactive setup wizard
npm run setup:azure
```

Choose from three setup modes:

| Mode | Use Case | Requirements |
|------|----------|--------------|
| **Simple** | Basic email relay | Global Admin consent |
| **Admin** | Full automation | Azure AD Admin credentials |
| **Manual** | Custom setup | Existing app registration |

### Authentication Methods

| Method | Best For | Azure Permission | SMTP Auth Required |
|--------|----------|-----------------|-------------------|
| **Graph API** ✅ | New installations | `Mail.Send` | No |
| **SMTP OAuth2** | Legacy compatibility | `SMTP.Send` | Yes |
| **Hybrid** | Fallback scenarios | Both | Yes |

[Authentication Methods Guide](docs/AUTH_METHODS_GUIDE.md)

### Legacy Device Configuration

```yaml
# IP whitelist for no-auth devices
ip_whitelist:
  no_auth_required:
    - "192.168.1.0/24"  # Printer VLAN
    
# Static users for legacy auth
legacy_auth:
  static_users:
    - username: "scanner"
      password: "SecurePassword2024!"
      allowed_ips: ["192.168.1.0/24"]
```

## 🔍 Management & Monitoring

### Web Dashboard
- **URL**: `https://your-server` (production) or `http://server:3001` (development)
- **Features**: 
  - Real-time statistics
  - Device management
  - Queue monitoring
  - Exchange setup wizard
  - IP whitelist management
  - Security event tracking

### CLI Management
```bash
# Service status with all endpoints
npm run status

# Security check
npm run security:check

# View logs
tail -f /var/log/smtp-relay/relay.log

# Monitor failed authentications
grep "LOGIN_FAILED" logs/auth-failures.log
```

## 📊 Typical Device Configurations

| Device Type | Port | Auth | TLS |
|------------|------|------|-----|
| Old Printers | 25 | No | No |
| Modern Printers | 587 | Optional | STARTTLS |
| NAS Systems | 587 | Yes | STARTTLS |
| Monitoring Tools | 25 | No | Optional |
| Security Cameras | 587 | Yes | STARTTLS |
| IoT Devices | 25 | No | Optional |

## 🛠️ Troubleshooting

### Common Issues

**Device cannot send emails**
```bash
# Check IP whitelist
cat config/config.yml | grep -A5 ip_whitelist

# Verify firewall
sudo firewall-cmd --list-all

# Check logs
tail -f /var/log/smtp-relay/relay.log
```

**Exchange authentication failed**
```bash
# Re-run setup wizard
npm run setup:azure

# Check token status
cat .tokens.json | jq .expires_at

# Reset authentication
rm .tokens.json
npm run setup:auth
```

**Service won't start**
```bash
# Check permissions
sudo chown -R smtp-relay:smtp-relay /opt/smtp-relay

# Verify directories
sudo /opt/smtp-relay/scripts/post-install.sh

# Check service logs
sudo journalctl -u smtp-relay -f
```

## 🔒 Security Features

### Authentication & Authorization
- Multi-Factor Authentication (TOTP + FIDO2)
- OAuth2 modern authentication
- httpOnly cookie authentication
- JWT tokens with refresh rotation

### Advanced Security
- Device fingerprinting
- Anomaly detection (impossible travel, unusual time)
- VPN/Proxy/Tor detection
- Exponential backoff lockout
- Rate limiting per IP/user

### Infrastructure Security
- Comprehensive security headers (CSP, HSTS, etc.)
- CSRF protection
- Input validation and sanitization
- Secure file operations
- Audit logging

[Security Documentation](SECURITY.md)

## 📚 Documentation

- [Azure Auto Setup Guide](docs/AZURE_AUTO_SETUP.md) - Automated Azure configuration
- [OAuth2 Setup Guide](docs/OAUTH2_SETUP.md) - OAuth2 authentication setup
- [MFA Setup Guide](docs/MFA_SETUP.md) - Multi-factor authentication
- [TLS Management](docs/TLS_MANAGEMENT.md) - Certificate configuration
- [Ansible Deployment](ansible/README.md) - Production deployment

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## 📄 License

MIT - See [LICENSE](LICENSE)

## 🆘 Support

- Issues: [GitHub Issues](https://github.com/SilvioTormen/smtprelay/issues)
- Security: See [SECURITY.md](SECURITY.md)