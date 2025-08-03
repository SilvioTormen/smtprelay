# Ansible Deployment for SMTP Relay

## Quick Start

### 1. Prepare Inventory

Create `inventory/hosts.yml`:

```yaml
all:
  children:
    smtp_relay_servers:
      hosts:
        relay1:
          ansible_host: 192.168.1.10
          ansible_user: root
          # Override Azure AD settings per host
          exchange_tenant_id: "12345678-1234-1234-1234-123456789012"
          exchange_client_id: "abcdef12-3456-7890-abcd-ef1234567890"
```

### 2. Create Vault for Secrets

```bash
# Create encrypted vault file
ansible-vault create inventory/group_vars/all/vault.yml
```

Add sensitive data:
```yaml
---
vault_exchange_client_secret: "your-secret-here"
vault_admin_password: "SuperSecure@2024!"
vault_helpdesk_password: "HelpDesk@2024!"
```

### 3. Deploy

```bash
# Test connection
ansible -i inventory/hosts.yml all -m ping

# Run playbook
ansible-playbook -i inventory/hosts.yml deploy.yml --ask-vault-pass

# Or with vault password file
ansible-playbook -i inventory/hosts.yml deploy.yml --vault-password-file ~/.vault_pass
```

## Configuration

### API Method Selection

The playbook supports all three API methods:

| Variable | Default | Description |
|----------|---------|-------------|
| `exchange_api_method` | `graph_api` | Choose: `graph_api` (recommended), `smtp_oauth2`, or `hybrid` |
| `exchange_auth_method` | `client_credentials` | Choose: `device_code`, `client_credentials`, or `authorization_code` |

### Important Variables

Edit `inventory/group_vars/all.yml` or set per host:

```yaml
# Required Azure AD settings
exchange_tenant_id: "your-tenant-id"
exchange_client_id: "your-app-id"
exchange_client_secret: "{{ vault_exchange_client_secret }}"
exchange_send_as: "relay@yourdomain.com"

# Network settings
smtp_ip_whitelist:
  - "192.168.1.0/24"  # Your printer network
  - "10.0.50.0/24"    # IoT devices

# Domain restrictions
allowed_recipient_domains:
  - "yourdomain.com"
  - "partner-domain.com"
```

### Port Configuration

Default ports (>1024 to avoid permission issues):
- `2525` - Plain SMTP (instead of 25)
- `2587` - Submission with STARTTLS (instead of 587)
- `2465` - SMTPS (instead of 465)
- `3001` - Web Dashboard

To use standard ports, set:
```yaml
smtp_port: 25
smtp_submission_port: 587
smtps_port: 465
```

## Post-Deployment

### 1. Initial OAuth2 Setup (if using Device Code)

```bash
# SSH to server
ssh root@relay1

# Run OAuth setup
cd /opt/smtp-relay
sudo -u smtp-relay npm run setup:auth
```

### 2. Verify Installation

```bash
# Check service status
systemctl status smtp-relay
systemctl status smtp-relay-dashboard

# Check logs
journalctl -u smtp-relay -f

# Test SMTP
telnet localhost 2525
```

### 3. Security Check

```bash
# Verify token file permissions
ls -la /opt/smtp-relay/.tokens.json
# Should show: -rw------- 1 smtp-relay smtp-relay

# Verify .env permissions
ls -la /opt/smtp-relay/.env
# Should show: -rw------- 1 smtp-relay smtp-relay
```

## Troubleshooting

### Node.js Issues

If you get Node.js version conflicts (especially on RHEL 10):
```bash
# Check current version
node --version

# If v22+ is installed, the playbook will use it
# No additional installation needed
```

### Token File Issues

The playbook automatically:
- Sets permissions to `0600` on `.tokens.json`
- Runs the post-install security script
- Creates `.env` with secure random secrets

### Dashboard Not Starting

Check if dashboard is enabled:
```yaml
dashboard_enabled: true
```

Verify dashboard service:
```bash
systemctl status smtp-relay-dashboard
```

## Security Notes

1. **Secrets Management**
   - Always use Ansible Vault for sensitive data
   - Never commit plaintext secrets to Git

2. **API Permissions**
   - Graph API with Application Permissions grants access to ALL mailboxes
   - Use Application Access Policy to restrict (see main README)
   - Consider using Delegated Permissions for better security

3. **Network Security**
   - IP whitelist is configured by default
   - Adjust `smtp_ip_whitelist` for your network
   - Firewall rules are automatically configured

## Advanced Usage

### Multiple Environments

Create separate inventory files:
```bash
inventory/
├── production/
│   ├── hosts.yml
│   └── group_vars/
└── staging/
    ├── hosts.yml
    └── group_vars/
```

Deploy to specific environment:
```bash
ansible-playbook -i inventory/production/hosts.yml deploy.yml
```

### Custom Certificates

To use custom TLS certificates:
```yaml
# In host_vars or group_vars
tls_cert_content: |
  -----BEGIN CERTIFICATE-----
  MIIDxTCCAq2gAwIBAgIQ...
  -----END CERTIFICATE-----

tls_key_content: !vault |
  $ANSIBLE_VAULT;1.1;AES256
  # Encrypted private key
```

### Monitoring Integration

The playbook exposes metrics on port 8080:
- Health check: `http://relay1:8080/health`
- Metrics: `http://relay1:8080/metrics`

## Rollback

To rollback a deployment:
```bash
# Stop services
ansible -i inventory/hosts.yml smtp_relay_servers -m systemd -a "name=smtp-relay state=stopped"

# Restore from backup
ansible -i inventory/hosts.yml smtp_relay_servers -m command -a "rsync -av /backup/smtp-relay/ /opt/smtp-relay/"

# Start services
ansible -i inventory/hosts.yml smtp_relay_servers -m systemd -a "name=smtp-relay state=started"
```