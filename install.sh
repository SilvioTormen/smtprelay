#!/bin/bash

#################################################
# SMTP Relay - One-Click Installation Script
# 
# This script handles the complete setup:
# - Installs dependencies
# - Sets up environment
# - Creates default user
# - Builds dashboard
# - Starts the application
#################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Banner
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "    📧 SMTP RELAY FOR EXCHANGE ONLINE - INSTALLER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Node.js
print_info "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d. -f1 | sed 's/v//')
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ required. Current: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) detected"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed."
    exit 1
fi
print_success "npm $(npm -v) detected"

# Install backend dependencies
print_info "Installing backend dependencies..."
npm install --production 2>/dev/null || npm install
print_success "Backend dependencies installed"

# Install dashboard dependencies
print_info "Installing dashboard dependencies..."
cd dashboard
npm install 2>/dev/null || npm install
cd ..
print_success "Dashboard dependencies installed"

# Generate secrets if not exists
if [ ! -f .env ]; then
    print_info "Generating security secrets..."
    cat > .env << EOF
# Auto-generated security secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
NODE_ENV=production
EOF
    print_success "Security secrets generated"
else
    print_info "Using existing .env file"
fi

# Create default config if not exists
if [ ! -f config.yml ]; then
    print_info "Creating default configuration..."
    cp config.example.yml config.yml 2>/dev/null || cat > config.yml << 'EOF'
# SMTP Relay Configuration
smtp:
  host: 0.0.0.0
  port: 2525
  secure: false
  auth:
    enabled: false

dashboard:
  enabled: true
  port: 3001
  session_secret: ${SESSION_SECRET}

# Exchange Online Configuration (configure via dashboard)
exchange_online:
  host: smtp.office365.com
  port: 587
  secure: false
  auth:
    method: device_code

rate_limit:
  enabled: true
  max_connections: 10
  messages_per_minute: 30

queue:
  retry_attempts: 3
  retry_delay: 60

logging:
  level: info
  file: ./logs/smtp-relay.log

security:
  allowed_domains: []
  allowed_ips: []
  reject_unauthorized: true
EOF
    print_success "Configuration file created"
else
    print_info "Using existing config.yml"
fi

# Create default admin user
if [ ! -f .users.enc ]; then
    print_info "Creating default admin user (admin/admin)..."
    node -e "
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');

const ENCRYPTION_KEY = crypto.randomBytes(32);
const IV = crypto.randomBytes(16);

const users = [{
  id: '1',
  username: 'admin',
  password: bcrypt.hashSync('admin', 10),
  role: 'admin',
  created: new Date().toISOString(),
  lastLogin: null,
  mfaEnabled: false
}];

const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
let encrypted = cipher.update(JSON.stringify(users), 'utf8', 'hex');
encrypted += cipher.final('hex');

fs.writeFileSync('.users.enc', JSON.stringify({
  iv: IV.toString('hex'),
  data: encrypted
}));
fs.writeFileSync('.encryption.key', ENCRYPTION_KEY.toString('hex'));

console.log('Admin user created');
" 2>/dev/null
    print_success "Default admin user created (username: admin, password: admin)"
    print_warning "⚠️  IMPORTANT: Change the default password after first login!"
else
    print_info "Users file already exists"
fi

# Build dashboard
print_info "Building dashboard..."
npm run dashboard:build 2>/dev/null || (cd dashboard && npm run build)
print_success "Dashboard built successfully"

# Create logs directory
mkdir -p logs

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    print_info "Starting application with PM2..."
    pm2 stop smtp-relay 2>/dev/null || true
    pm2 delete smtp-relay 2>/dev/null || true
    NODE_ENV=production pm2 start src/index.js --name smtp-relay
    pm2 save 2>/dev/null || true
    
    print_success "Application started with PM2"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🎉 Installation Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  📊 Dashboard:     http://localhost:3001"
    echo "  👤 Username:      admin"
    echo "  🔑 Password:      admin"
    echo "  📧 SMTP Port:     2525"
    echo ""
    echo "  Useful commands:"
    echo "  • pm2 status         - Check status"
    echo "  • pm2 logs smtp-relay - View logs"
    echo "  • pm2 restart smtp-relay - Restart"
    echo "  • pm2 stop smtp-relay - Stop"
    echo ""
else
    # Offer to run without PM2
    print_warning "PM2 not installed. Install with: npm install -g pm2"
    echo ""
    read -p "Start application without PM2? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Starting application..."
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  🎉 Installation Complete!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  📊 Dashboard:     http://localhost:3001"
        echo "  👤 Username:      admin"
        echo "  🔑 Password:      admin"
        echo "  📧 SMTP Port:     2525"
        echo ""
        echo "  Press Ctrl+C to stop"
        echo ""
        NODE_ENV=production node src/index.js
    else
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  ✅ Installation Complete!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  Start the application with:"
        echo "  • npm start"
        echo "  • node src/index.js"
        echo ""
        echo "  📊 Dashboard:     http://localhost:3001"
        echo "  👤 Username:      admin"
        echo "  🔑 Password:      admin"
        echo "  📧 SMTP Port:     2525"
        echo ""
    fi
fi