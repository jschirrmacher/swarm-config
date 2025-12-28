#!/bin/bash
set -e

echo "🚀 Starting initial server setup..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Please run as root (use sudo)"
  exit 1
fi

# Step 1: Update system and install Git
echo "📦 Step 1: Installing Git and system updates..."
apt update
apt upgrade -y
apt install -y git curl

echo "✅ Git installed"
echo ""

# Step 2: Install Node.js globally via NodeSource
echo "📦 Step 2: Installing Node.js 24 LTS globally..."

# Add NodeSource repository for Node.js 24.x
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -

# Install Node.js (includes npm)
apt install -y nodejs

# Verify installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
echo "✅ Node.js $NODE_VERSION installed globally"
echo "✅ npm $NPM_VERSION installed globally"
echo ""

# Step 3: Create workspace and clone repository
echo "📁 Step 3: Setting up workspace..."
mkdir -p /var/apps
cd /var/apps

if [ -d "swarm-config" ]; then
  echo "⚠️  swarm-config directory already exists, skipping clone"
else
  echo "Cloning swarm-config repository (branch: next)..."
  git clone -b next https://github.com/jschirrmacher/swarm-config.git
  echo "✅ Repository cloned from next branch"
fi

cd swarm-config

# Step 4: Create config file if it doesn't exist
if [ ! -f ".swarm-config" ]; then
  echo ""
  echo "📝 Step 4: Creating .swarm-config file..."
  
  # Ask for domain name
  read -p "Enter your base domain (e.g., example.com): " DOMAIN
  read -p "Enter your server hostname (e.g., server.example.com): " SERVER_HOST
  
  # Create .swarm-config with user input
  cat > .swarm-config << EOF
# Swarm Config - Server Configuration

# Base domain for your server
# Apps will be available at <appname>.<DOMAIN>
DOMAIN=${DOMAIN}

# Server hostname for SSH access
SERVER_HOST=${SERVER_HOST}

# Base URL for downloading git hooks
HOOKS_BASE_URL=https://\${SERVER_HOST}/scripts
EOF
  
  echo "✅ Created .swarm-config with domain: ${DOMAIN}"
  echo ""
else
  echo "✅ .swarm-config already exists"
fi

# Step 5: Install npm dependencies
echo "📦 Step 5: Installing npm dependencies..."
npm install --prefix /var/apps/swarm-config
echo "✅ Dependencies installed"
echo ""

# Final instructions
echo "✅ Initial setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit your configuration: nano /var/apps/swarm-config/.swarm-config"
echo "2. Run the bootstrap script: cd /var/apps/swarm-config && sudo npm run bootstrap:fix"
echo ""
echo "The bootstrap script will automatically configure:"
echo "  - Docker & Docker Swarm"
echo "  - UFW Firewall"
echo "  - Team users from SSH keys"
echo "  - SSH security"
echo "  - Kong network"
echo "  - GlusterFS (if needed)"
