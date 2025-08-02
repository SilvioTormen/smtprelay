# TLS Certificate Management Guide

The SMTP Relay now includes a comprehensive TLS certificate management system accessible through the web dashboard.

## 🎯 Features

- **Web-based Certificate Management**: Upload, generate, and manage certificates from the dashboard
- **Multiple Certificate Options**:
  - Upload existing certificates
  - Generate self-signed certificates
  - Integrate with Let's Encrypt (automatic renewal)
- **Certificate Monitoring**: Real-time status, expiry tracking, and validation
- **Automatic Backup**: Previous certificates are backed up before replacement

## 🌐 Accessing Certificate Management

1. Login to the dashboard: `http://server:3001`
2. Navigate to **Settings** → **TLS Certificates**
3. Admin privileges required

## 📋 Certificate Options

### Option 1: Upload Existing Certificate

Perfect if you already have certificates from a CA.

**Required files:**
- Certificate file (`.pem` or `.crt`)
- Private key file (`.pem` or `.key`)
- Certificate chain (optional, for intermediate certificates)

**Steps:**
1. Click **Upload Certificate**
2. Select your certificate files
3. Click **Upload**
4. Restart the service: `sudo systemctl restart smtp-relay`

### Option 2: Generate Self-Signed Certificate

Quick solution for internal networks and testing.

**Steps:**
1. Click **Generate Self-Signed**
2. Enter certificate details:
   - Common Name (required): Your server's FQDN
   - Country, State, City (optional)
   - Organization (optional)
   - Validity period (default: 365 days)
3. Click **Generate**
4. Restart the service

**Example:**
```
Common Name: smtp-relay.company.local
Country: US
State: California
City: San Francisco
Organization: ACME Corp
Validity: 365 days
```

### Option 3: Let's Encrypt Certificate

Free, trusted certificates with automatic renewal.

**Prerequisites:**
- Domain must be publicly accessible
- Port 80 must be open from the internet
- DNS must point to your server

**Steps:**
1. Click **Generate Let's Encrypt**
2. Enter:
   - Domain: `smtp.yourdomain.com`
   - Email: `admin@yourdomain.com`
   - Staging: Enable for testing (recommended first)
3. Click **Generate**
4. Service automatically reloads

**Enable Auto-Renewal:**
```bash
# Add to crontab (the command is shown after generation)
0 0 * * * certbot renew --quiet && systemctl reload smtp-relay
```

## 🔍 Certificate Status Monitoring

The dashboard displays:
- **Certificate Status**: Installed/Not installed
- **Subject**: Certificate common name
- **Issuer**: Who issued the certificate
- **Expiry Date**: When it expires
- **Days Until Expiry**: Color-coded warning
  - 🟢 Green: >30 days
  - 🟡 Yellow: <30 days
  - 🔴 Red: Expired
- **SANs**: Subject Alternative Names
- **Fingerprint**: SHA256 certificate fingerprint

## 🛠️ API Endpoints

For automation and integration:

### Get Certificate Status
```bash
curl -X GET http://localhost:3001/api/certificates/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Upload Certificate
```bash
curl -X POST http://localhost:3001/api/certificates/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "certificate=@/path/to/cert.pem" \
  -F "privateKey=@/path/to/key.pem" \
  -F "chain=@/path/to/chain.pem"
```

### Generate Self-Signed
```bash
curl -X POST http://localhost:3001/api/certificates/generate-self-signed \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "commonName": "smtp-relay.local",
    "country": "US",
    "state": "CA",
    "locality": "San Francisco",
    "organization": "ACME Corp",
    "days": 365
  }'
```

### Generate Let's Encrypt
```bash
curl -X POST http://localhost:3001/api/certificates/generate-letsencrypt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "smtp.yourdomain.com",
    "email": "admin@yourdomain.com",
    "staging": false
  }'
```

### Download Certificate (Backup)
```bash
curl -X GET http://localhost:3001/api/certificates/download/certificate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o cert-backup.pem
```

### Test TLS Configuration
```bash
curl -X POST http://localhost:3001/api/certificates/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "localhost",
    "port": 465
  }'
```

## 🔒 Security Best Practices

1. **Always use HTTPS for the dashboard** in production
2. **Backup certificates** before making changes
3. **Monitor expiry dates** - set up alerts for <30 days
4. **Use Let's Encrypt staging** for testing first
5. **Restrict certificate management** to admin users only
6. **Rotate certificates** regularly (Let's Encrypt does this automatically)

## 📁 File Locations

- **Certificates**: `/smtprelay/certs/`
  - `cert.pem` - Main certificate
  - `key.pem` - Private key (chmod 600)
  - `chain.pem` - Certificate chain (if applicable)
- **Backups**: `/smtprelay/certs/backup/[timestamp]/`
- **Let's Encrypt**: `/etc/letsencrypt/live/[domain]/`

## 🔧 Troubleshooting

### Certificate Not Loading
1. Check file permissions: `ls -la /smtprelay/certs/`
2. Verify certificate validity: `openssl x509 -in cert.pem -noout -text`
3. Check service logs: `journalctl -u smtp-relay -f`

### Let's Encrypt Fails
1. Verify port 80 is accessible: `sudo firewall-cmd --list-ports`
2. Check DNS: `nslookup your-domain.com`
3. Try staging environment first
4. Check rate limits: https://letsencrypt.org/docs/rate-limits/

### Certificate Mismatch
1. Verify cert and key match:
```bash
openssl x509 -in cert.pem -noout -modulus | openssl md5
openssl rsa -in key.pem -noout -modulus | openssl md5
# Both should output the same hash
```

### Service Won't Start After Certificate Change
1. Check certificate format: Must be PEM format
2. Verify private key is not encrypted
3. Check logs: `tail -f /var/log/smtp-relay/relay.log`
4. Restore from backup if needed

## 🔄 Certificate Renewal

### Let's Encrypt (Automatic)
```bash
# Test renewal
sudo certbot renew --dry-run

# Setup auto-renewal via cron
sudo crontab -e
0 0 * * * certbot renew --quiet && systemctl reload smtp-relay
```

### Manual Renewal Reminder
The dashboard will show warnings when certificates are expiring:
- 30 days before: Yellow warning
- 7 days before: Red alert
- Expired: Service may fail to start

## 🚀 Quick Start

1. **For Testing (Self-Signed)**:
   - Dashboard → Settings → Generate Self-Signed
   - Enter your server name
   - Generate & Restart

2. **For Production (Let's Encrypt)**:
   - Ensure domain is public
   - Dashboard → Settings → Generate Let's Encrypt
   - Use staging first
   - Switch to production when ready
   - Setup auto-renewal

3. **For Enterprise (Custom CA)**:
   - Get certificate from your CA
   - Dashboard → Settings → Upload Certificate
   - Upload cert, key, and chain
   - Restart service