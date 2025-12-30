#!/bin/bash
# Swarm Config Setup Script
# Main orchestration script

set -e  # Exit on error

# Function: Check root privileges
check_root() {
  echo "🔐 Checking root privileges..."
  
  if [ "$EUID" -ne 0 ]; then
    echo "  ❌ This script must be run as root"
    echo "  Please run: sudo bash setup.sh"
    echo ""
    exit 1
  fi
  
  echo "  ✅ Running as root"
  echo ""
}

# Function: Install Node.js and clone/update repository
install_node_and_workspace() {
  echo "📦 Installing Node.js and setting up workspace..."

  # Install Node.js 24 LTS via NodeSource
  echo "  Installing Node.js 24 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt install -y nodejs git curl jq

  NODE_VERSION=$(node --version)
  echo "  ✅ Node.js $NODE_VERSION installed"

  # Setup workspace
  echo "  Setting up workspace..."
  mkdir -p /var/apps
  cd /var/apps

  if [ -d "swarm-config" ]; then
    echo "  ⚠️  swarm-config directory already exists, updating..."
    
    chown -R root:root /var/apps/swarm-config
    cd swarm-config
    
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$REMOTE_URL" == git@github.com:* ]]; then
      echo "    🔄 Switching remote URL from SSH to HTTPS..."
      git remote set-url origin https://github.com/jschirrmacher/swarm-config.git
    fi
    
    BACKUP_DIR=$(mktemp -d)
    echo "    📦 Backing up local configuration..."
    cp -r config "$BACKUP_DIR/" 2>/dev/null || true
    cp .swarm-config "$BACKUP_DIR/" 2>/dev/null || true
    cp config.ts "$BACKUP_DIR/" 2>/dev/null || true
    
    git fetch origin
    git checkout -B next origin/next
    
    if [ -f "$BACKUP_DIR/.swarm-config" ]; then
      cp "$BACKUP_DIR/.swarm-config" .swarm-config
      echo "    ✅ Restored .swarm-config"
    fi
    
    if [ -f "$BACKUP_DIR/config.ts" ]; then
      cp "$BACKUP_DIR/config.ts" config.ts
      echo "    📦 Found legacy config.ts - migrating..."
      npx tsx src/migrate-config.ts || echo "    ⚠️  Migration failed - manual migration required"
    fi
    
    echo "    📝 Restoring local-only configuration files..."
    if [ -d "$BACKUP_DIR/config" ]; then
      cd "$BACKUP_DIR/config"
      find . -type f -name "*.ts" | while read -r file; do
        TARGET_FILE="/var/apps/swarm-config/config/$file"
        if [ ! -f "$TARGET_FILE" ]; then
          cp --parents "$file" "/var/apps/swarm-config/config/" 2>/dev/null || true
          echo "      Restored: config/$file"
        fi
      done
    fi
    rm -rf "$BACKUP_DIR"
    cd /var/apps/swarm-config
    
    echo "    ✅ Updated to latest version"
  else
    echo "  Cloning swarm-config repository..."
    git clone -b next https://github.com/jschirrmacher/swarm-config.git
    cd swarm-config
    echo "  ✅ Repository cloned"
  fi

  echo "  Installing npm dependencies..."
  export NUXT_TELEMETRY_DISABLED=1
  npm install

  echo "✅ Workspace ready"
  echo ""
}

# Handle domain from command-line argument or environment variable
if [ -n "$1" ]; then
  export SWARM_DOMAIN="$1"
  echo "ℹ️  Using domain from argument: $SWARM_DOMAIN"
  echo ""
elif [ -n "$SWARM_DOMAIN" ]; then
  export SWARM_DOMAIN
  echo "ℹ️  Using domain from environment: $SWARM_DOMAIN"
  echo ""
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Swarm Config - Server Setup & Installation          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will set up your server with:"
echo "  • Docker & Docker Swarm"
echo "  • UFW Firewall"
echo "  • Team user accounts from SSH keys"
echo "  • Kong API Gateway with Let's Encrypt SSL"
echo "  • Swarm Config Web UI"
echo "  • Optional: GlusterFS for distributed storage"
echo ""

# Execute initial steps
check_root
install_node_and_workspace

# Execute remaining steps from local repository
STEPS_DIR="/var/apps/swarm-config/scripts/steps"
echo "📂 Running remaining steps from repository..."
echo ""

for step_file in "$STEPS_DIR"/*; do
  if [ -f "$step_file" ]; then
    # Execute TypeScript files with tsx, bash files with source
    if [[ "$step_file" == *.ts ]]; then
      npx tsx "$step_file"
    elif [[ "$step_file" == *.sh ]]; then
      source "$step_file"
    fi
  fi
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete! 🎉                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Services are now running:"
echo "  • Kong API Gateway: https://$DOMAIN"
echo "  • Web UI: https://config.$DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Access Web UI: https://config.$DOMAIN"
echo "  2. Create your first app repository"
echo "  3. Push your code: git push production main"
echo ""
echo "For team users:"
echo "  • Check ~/.swarm-config-password for Web UI credentials"
echo "  • SSH access configured for all authorized_keys users"
echo ""
echo "📚 Documentation:"
echo "  • For app developers: /var/apps/swarm-config/docs/APP-DEVELOPER.md"
echo "  • For administrators: /var/apps/swarm-config/docs/ADMIN-SETUP.md"
echo "  • GitHub: https://github.com/jschirrmacher/swarm-config"
echo ""
