#!/bin/bash

# Start script that ensures dashboard is built

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Starting SMTP Relay with Dashboard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from /opt/smtp-relay directory"
    exit 1
fi

# Check if dashboard build exists
if [ ! -d "dashboard/dist" ] && [ ! -d "dashboard/build" ]; then
    echo "📦 Building dashboard for first time..."
    if [ -f "dashboard/package.json" ]; then
        echo "Installing dashboard dependencies..."
        npm install --prefix dashboard
        
        echo "Building dashboard..."
        npm run build --prefix dashboard
        
        if [ $? -eq 0 ]; then
            echo "✅ Dashboard built successfully"
        else
            echo "⚠️  Dashboard build failed, continuing without dashboard"
        fi
    else
        echo "⚠️  Dashboard not found, continuing without it"
    fi
else
    echo "✅ Dashboard build found"
fi

# Load environment variables
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start the application
echo ""
echo "Starting SMTP Relay Service..."
node src/index.js