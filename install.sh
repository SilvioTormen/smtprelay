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

# Parse command line arguments
MODE=""
for arg in "$@"; do
    case $arg in
        --dev|--development)
            MODE="development"
            shift
            ;;
        --prod|--production)
            MODE="production"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dev, --development    Install in development mode (default)"
            echo "  --prod, --production    Install in production mode (requires certificates)"
            echo "  --help, -h             Show this help message"
            echo ""
            echo "Examples:"
            echo "  ./install.sh              # Development mode (default)"
            echo "  ./install.sh --dev        # Development mode (explicit)"
            echo "  ./install.sh --prod       # Production mode"
            echo ""
            exit 0
            ;;
        *)
            print_error "Unknown option: $arg"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# If no mode specified, ask user
if [ -z "$MODE" ]; then
    echo "Please select installation mode:"
    echo ""
    echo "  1) Development (recommended for testing)"
    echo "  2) Production (requires TLS certificates)"
    echo ""
    read -p "Enter choice [1-2] (default: 1): " choice
    choice=${choice:-1}
    
    case $choice in
        1)
            MODE="development"
            ;;
        2)
            MODE="production"
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
fi

print_info "Installing in ${MODE^^} mode"
echo ""

# Production mode warnings
if [ "$MODE" = "production" ]; then
    print_warning "Production mode requirements:"
    echo "  • TLS certificates (cert.pem, key.pem)"
    echo "  • HTTPS configuration"
    echo "  • Strong passwords"
    echo "  • Redis with password (optional)"
    echo ""
    read -p "Do you have all requirements ready? (y/N): " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Switching to development mode..."
        MODE="development"
    fi
fi

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
NODE_ENV=$MODE
EOF
    
    # Add production-specific configs
    if [ "$MODE" = "production" ]; then
        cat >> .env << EOF

# Production settings
FORCE_HTTPS=true
TLS_CERT_PATH=./certs/cert.pem
TLS_KEY_PATH=./certs/key.pem
RP_ID=your-domain.com
ORIGIN=https://your-domain.com
ADMIN_INITIAL_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64'))")
REDIS_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(12).toString('base64'))")
EOF
        print_warning "Production mode: Update .env with your domain and paths!"
    fi
    
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

# Create default admin user in correct location
if [ ! -f data/users.json ]; then
    print_info "Creating default admin user (admin/admin)..."
    mkdir -p data
    node -e "
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');

// Create data directory
if (!fs.existsSync('data')) {
  fs.mkdirSync('data', { recursive: true });
}

// Create encryption key
const ENCRYPTION_KEY = crypto.randomBytes(32);
fs.writeFileSync('data/.encryption.key', ENCRYPTION_KEY.toString('hex'));

// Create admin user
const users = {
  admin: {
    id: '1',
    username: 'admin',
    password: bcrypt.hashSync('admin', 10),
    role: 'admin',
    permissions: ['read', 'write', 'delete', 'configure', 'manage_users'],
    displayName: 'Administrator',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    failedAttempts: 0,
    lockedUntil: null,
    totpSecret: null,
    totpEnabled: false,
    mfaEnforced: false,
    lastLogin: null,
    passwordChangedAt: new Date().toISOString(),
    requirePasswordChange: false,
    locked: false
  }
};

// Write users file
fs.writeFileSync('data/users.json', JSON.stringify(users, null, 2));

// Create empty MFA file (no MFA by default!)
fs.writeFileSync('data/mfa.json', JSON.stringify({}));

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

# Production mode certificate check
if [ "$MODE" = "production" ]; then
    if [ ! -d certs ]; then
        print_warning "Creating certs directory..."
        mkdir -p certs
        print_warning "Add your TLS certificates to ./certs/"
        print_warning "  - cert.pem (certificate)"
        print_warning "  - key.pem (private key)"
    fi
fi

# Check if PM2 is installed
if command -v pm2 &> /dev/null; then
    print_info "Starting application with PM2..."
    pm2 stop smtp-relay 2>/dev/null || true
    pm2 delete smtp-relay 2>/dev/null || true
    NODE_ENV=$MODE pm2 start src/index.js --name smtp-relay
    pm2 save 2>/dev/null || true
    
    print_success "Application started with PM2"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🎉 Installation Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Mode:             ${MODE^^}"
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
    
    if [ "$MODE" = "production" ]; then
        print_warning "Production mode checklist:"
        echo "  ☐ Update .env with your domain settings"
        echo "  ☐ Add TLS certificates to ./certs/"
        echo "  ☐ Configure Redis password if using Redis"
        echo "  ☐ Change default admin password"
        echo "  ☐ Enable MFA for admin users"
    fi
else
    print_info "Starting application with Node.js..."
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  🎉 Installation Complete!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Mode:             ${MODE^^}"
    echo "  📊 Dashboard:     http://localhost:3001"
    echo "  👤 Username:      admin"
    echo "  🔑 Password:      admin"
    echo "  📧 SMTP Port:     2525"
    echo ""
    echo "  Start the application:"
    echo "  • NODE_ENV=$MODE npm start"
    echo ""
    print_info "Install PM2 for better process management:"
    echo "  npm install -g pm2"
fi