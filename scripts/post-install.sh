#!/bin/bash

# Post-Installation Security Script
# Run this after moving files to /opt/smtp-relay

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔒 SMTP Relay Post-Installation Security"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Please run as root (sudo)"
  exit 1
fi

# Set correct ownership for entire directory
echo "Setting ownership for /opt/smtp-relay..."
chown -R smtp-relay:smtp-relay /opt/smtp-relay

# Secure sensitive files
echo "Securing sensitive files..."

# Token file (if exists)
if [ -f "/opt/smtp-relay/.tokens.json" ]; then
  chmod 600 /opt/smtp-relay/.tokens.json
  chown smtp-relay:smtp-relay /opt/smtp-relay/.tokens.json
  echo "✅ Token file secured (.tokens.json)"
fi

# Environment file (if exists)
if [ -f "/opt/smtp-relay/.env" ]; then
  chmod 600 /opt/smtp-relay/.env
  chown smtp-relay:smtp-relay /opt/smtp-relay/.env
  echo "✅ Environment file secured (.env)"
fi

# Config file (if exists)
if [ -f "/opt/smtp-relay/config.yml" ]; then
  chmod 640 /opt/smtp-relay/config.yml
  chown smtp-relay:smtp-relay /opt/smtp-relay/config.yml
  echo "✅ Config file secured (config.yml)"
fi

# Set directory permissions
echo "Setting directory permissions..."
chmod 755 /opt/smtp-relay
chmod 750 /opt/smtp-relay/logs
chmod 750 /opt/smtp-relay/queue
chmod 750 /opt/smtp-relay/certs
chmod 750 /opt/smtp-relay/.temp 2>/dev/null

# Create log directory if not exists
if [ ! -d "/var/log/smtp-relay" ]; then
  mkdir -p /var/log/smtp-relay
  chown smtp-relay:smtp-relay /var/log/smtp-relay
  chmod 750 /var/log/smtp-relay
  echo "✅ Log directory created"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Post-installation security complete!"
echo ""
echo "Next steps:"
echo "1. Start the service: sudo systemctl start smtp-relay"
echo "2. Check status: sudo systemctl status smtp-relay"
echo "3. View logs: sudo journalctl -u smtp-relay -f"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"