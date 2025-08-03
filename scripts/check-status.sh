#!/bin/bash

# SMTP Relay Status Check Script
# Shows all service endpoints and their availability

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SMTP RELAY SERVICE STATUS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check service status
echo "🔧 System Service:"
echo "────────────────"
if systemctl is-active --quiet smtp-relay; then
    echo "✅ smtp-relay.service: RUNNING"
    UPTIME=$(systemctl show smtp-relay --property=ActiveEnterTimestamp --value)
    echo "   Started: $UPTIME"
else
    echo "❌ smtp-relay.service: NOT RUNNING"
    echo "   Start with: sudo systemctl start smtp-relay"
fi
echo ""

# Get configured ports from .env
if [ -f /opt/smtp-relay/.env ]; then
    source /opt/smtp-relay/.env
    SMTP_PORT=${SMTP_PORT:-2525}
    SMTP_SUBMISSION_PORT=${SMTP_SUBMISSION_PORT:-2587}
    SMTPS_PORT=${SMTPS_PORT:-2465}
    WEB_PORT=${WEB_PORT:-3001}
else
    # Default ports
    SMTP_PORT=2525
    SMTP_SUBMISSION_PORT=2587
    SMTPS_PORT=2465
    WEB_PORT=3001
fi

# Get hostname and IPs
HOSTNAME=$(hostname -f 2>/dev/null || hostname)
# Try multiple methods to get IP address
PRIMARY_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \K\S+' || \
             ip addr show 2>/dev/null | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | cut -d/ -f1 || \
             hostname -I 2>/dev/null | awk '{print $1}' || \
             echo "localhost")

echo "📮 SMTP Service Endpoints:"
echo "──────────────────────────"

# Function to check if port is listening
check_port() {
    local port=$1
    if ss -ltn | grep -q ":$port "; then
        echo "✅"
    else
        echo "❌"
    fi
}

# Display SMTP endpoints
echo "Plain SMTP (Port $SMTP_PORT):        $(check_port $SMTP_PORT)"
echo "  • telnet $HOSTNAME $SMTP_PORT"
echo "  • telnet $PRIMARY_IP $SMTP_PORT"
echo ""

echo "STARTTLS (Port $SMTP_SUBMISSION_PORT):       $(check_port $SMTP_SUBMISSION_PORT)"
echo "  • $HOSTNAME:$SMTP_SUBMISSION_PORT"
echo "  • $PRIMARY_IP:$SMTP_SUBMISSION_PORT"
echo ""

echo "Implicit TLS (Port $SMTPS_PORT):     $(check_port $SMTPS_PORT)"
echo "  • $HOSTNAME:$SMTPS_PORT"
echo "  • $PRIMARY_IP:$SMTPS_PORT"
echo ""

echo "🌐 Web Dashboard:"
echo "─────────────────"
echo "Dashboard (Port $WEB_PORT):          $(check_port $WEB_PORT)"
echo "  • http://$HOSTNAME:$WEB_PORT"
echo "  • http://$PRIMARY_IP:$WEB_PORT"
echo "  • http://localhost:$WEB_PORT"
echo ""

# Check if dashboard service is running
if systemctl is-active --quiet smtp-relay-dashboard 2>/dev/null; then
    echo "✅ Dashboard service: RUNNING"
else
    echo "ℹ️  Dashboard: Included in main service"
fi
echo ""

# Check firewall status
echo "🔥 Firewall Status:"
echo "───────────────────"
if command -v firewall-cmd &> /dev/null; then
    if systemctl is-active --quiet firewalld; then
        OPEN_PORTS=$(firewall-cmd --list-ports 2>/dev/null || echo "Unable to check")
        echo "Firewalld: ACTIVE"
        echo "Open ports: $OPEN_PORTS"
        
        # Check if our ports are open
        for port in $SMTP_PORT $SMTP_SUBMISSION_PORT $SMTPS_PORT $WEB_PORT; do
            if echo "$OPEN_PORTS" | grep -q "$port/tcp"; then
                echo "  ✅ Port $port/tcp is open"
            else
                echo "  ⚠️  Port $port/tcp not open in firewall"
            fi
        done
    else
        echo "Firewalld: NOT RUNNING"
    fi
else
    echo "Firewalld: NOT INSTALLED"
fi
echo ""

# Check OAuth2 status
echo "🔐 OAuth2 Status:"
echo "─────────────────"
if [ -f /opt/smtp-relay/.tokens.json ]; then
    echo "✅ OAuth2 tokens configured"
    PERMS=$(stat -c %a /opt/smtp-relay/.tokens.json)
    if [ "$PERMS" = "600" ]; then
        echo "✅ Token file properly secured (600)"
    else
        echo "⚠️  Token file permissions: $PERMS (should be 600)"
    fi
else
    echo "❌ No OAuth2 tokens found"
    echo "   Run: sudo -u smtp-relay npm run setup:auth"
fi
echo ""

# Quick connectivity test
echo "🧪 Quick Tests:"
echo "───────────────"
if systemctl is-active --quiet smtp-relay; then
    # Test SMTP banner
    echo "Testing SMTP connection..."
    if timeout 2 bash -c "echo 'QUIT' | nc -w 1 localhost $SMTP_PORT 2>/dev/null | grep -q '220'"; then
        echo "✅ SMTP responds on port $SMTP_PORT"
    else
        echo "⚠️  SMTP not responding on port $SMTP_PORT"
    fi
    
    # Test web dashboard
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$WEB_PORT/api/health 2>/dev/null | grep -q "200"; then
        echo "✅ Dashboard API healthy"
    else
        echo "⚠️  Dashboard API not responding"
    fi
else
    echo "⚠️  Service not running - start it first"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📌 Quick Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Start service:    sudo systemctl start smtp-relay"
echo "View logs:        sudo journalctl -u smtp-relay -f"
echo "Test SMTP:        telnet localhost $SMTP_PORT"
echo "Open dashboard:   http://$PRIMARY_IP:$WEB_PORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 After starting the service, run 'npm run status' again to see all active endpoints."