# Production Setup Guide

## Quick Start

The SMTP Relay app now supports easier production deployment with automatic security configuration.

### 1. Initial Startup

Start the app in production mode:

```bash
NODE_ENV=production npm start
# or with PM2:
NODE_ENV=production pm2 start src/index.js --name smtp-relay
```

The app will:
- ✅ Auto-generate missing security secrets
- ✅ Create temporary admin passwords
- ✅ Start with basic security
- ⚠️ Show security warnings (not blocking)

### 2. Save Generated Secrets

On first startup, you'll see generated secrets in the console:

```
🔑 Generated JWT_SECRET - Save this in your .env file for persistence
🔑 Generated JWT_REFRESH_SECRET - Save this in your .env file for persistence
🔑 Generated SESSION_SECRET - Save this in your .env file for persistence
🔑 Generated ENCRYPTION_KEY - Save this in your .env file for persistence
```

**IMPORTANT**: Copy these values to `.env` or `.env.production` file to maintain sessions across restarts.

### 3. Security Configuration Options

#### Option A: Behind Reverse Proxy (Recommended)

If using nginx/Apache with SSL termination:

```env
BEHIND_PROXY=true
TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8
```

nginx example:
```nginx
server {
    listen 443 ssl http2;
    server_name smtp-relay.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Option B: Direct HTTPS

Configure TLS certificates directly:

```env
FORCE_HTTPS=true
TLS_CERT_PATH=/path/to/cert.pem
TLS_KEY_PATH=/path/to/key.pem
```

### 4. Configure via Admin GUI

After startup, login to the admin dashboard at `https://your-domain:3001`

Navigate to **Settings → System Config** to:
- View Security Status Dashboard
- Configure MFA/WebAuthn
- Set up Exchange Online
- Manage IP Whitelisting
- Review Security Recommendations

### 5. Security Checklist

#### Critical (Required)
- [x] Security secrets auto-generated
- [x] Change default admin passwords on first login
- [x] Configure HTTPS (proxy or direct)

#### Recommended
- [ ] Enable MFA for admin accounts
- [ ] Configure IP whitelisting
- [ ] Set up audit logging
- [ ] Regular security updates

#### Optional
- [ ] WebAuthn/FIDO2 authentication
- [ ] Redis for session storage
- [ ] External database (PostgreSQL/MySQL)
- [ ] Monitoring (Sentry, etc.)

## Environment Variables

### Minimal Production Config

```env
NODE_ENV=production
# Secrets will be auto-generated
```

### Full Production Config

See `.env.production` for all available options.

## Security Status API

Monitor security status programmatically:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-domain/api/security/status
```

Response:
```json
{
  "overall": "good",
  "score": 85,
  "critical": {
    "secrets": { "status": "configured" },
    "authentication": { "status": "configured" }
  },
  "recommendations": [...]
}
```

## Troubleshooting

### App won't start in production
- Check logs for specific errors
- Ensure ports are not in use
- Verify file permissions

### Security warnings
- Warnings are informational only
- App will start even with warnings
- Address warnings through admin GUI

### Lost admin password
- Delete `users.json` and restart
- New temporary passwords will be generated

## Support

For issues or questions:
- Check logs in `/var/log/smtp-relay/`
- Review security status in admin dashboard
- Enable DEBUG mode temporarily for troubleshooting