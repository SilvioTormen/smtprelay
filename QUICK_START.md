# 🚀 Quick Start Guide

## One-Command Installation

### Option 1: Automatic Installation (Recommended)
```bash
# Clone and install in one command
git clone https://github.com/SilvioTormen/smtprelay.git && cd smtprelay && ./install.sh
```

The installer will:
- ✅ Install all dependencies
- ✅ Generate security secrets
- ✅ Create default admin user
- ✅ Build the dashboard
- ✅ Start the application

### Option 2: Using npm
```bash
# Clone the repository
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay

# Install (auto-setup runs automatically)
npm install

# Start the application
npm start
```

### Option 3: With PM2 (Production)
```bash
# Install PM2 globally (if not installed)
npm install -g pm2

# Clone and setup
git clone https://github.com/SilvioTormen/smtprelay.git
cd smtprelay
npm install

# Start with PM2
npm run pm2
```

## 🎯 After Installation

1. **Access the Dashboard**
   - URL: http://localhost:3001
   - Username: `admin`
   - Password: `admin`

2. **First Steps**
   - Change the default password
   - Configure Exchange Online
   - Set up Azure AD authentication

3. **SMTP Relay Port**
   - Default: Port 2525
   - Configure your devices to use this port

## 📋 System Requirements

- Node.js 18+ 
- npm 8+
- 1GB RAM minimum
- 500MB disk space

## 🛠️ Troubleshooting

If automatic setup fails, run manually:

```bash
# Install dependencies
npm install
cd dashboard && npm install && npm run build && cd ..

# Create default user
node scripts/auto-setup.js

# Start application
npm start
```

## 📊 Management Commands

```bash
# With PM2
pm2 status              # Check status
pm2 logs smtp-relay     # View logs
pm2 restart smtp-relay  # Restart
pm2 stop smtp-relay     # Stop

# Without PM2
npm start              # Start application
npm run status         # Check status
```

## 🔒 Security Notes

⚠️ **IMPORTANT**: 
- Change the default admin password immediately
- Generate new secrets for production: `npm run security:generate`
- Enable MFA for admin accounts
- Configure firewall rules for SMTP port

## 📚 Full Documentation

See [README.md](README.md) for complete documentation.