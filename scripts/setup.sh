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

# Function: Configure automatic security updates
configure_security_updates() {
  echo "🔒 Configuring automatic security updates..."
  
  # Install unattended-upgrades package
  apt update
  apt install -y unattended-upgrades

  # Configure automatic updates
  cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
// Automatically upgrade packages from these origins
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// List of packages to not update (blacklist)
Unattended-Upgrade::Package-Blacklist {
    // Exclude Docker packages from automatic updates (should be managed manually)
    "docker-ce";
    "docker-ce-cli";
    "containerd.io";
};

// Automatically reboot WITHOUT CONFIRMATION if required
// after a kernel update
Unattended-Upgrade::Automatic-Reboot "true";

// Reboot at specific time (2:00 AM)
Unattended-Upgrade::Automatic-Reboot-Time "02:00";

// Do automatic removal of unused kernel packages
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";

// Remove unused dependencies
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// Send email notifications (if mail is configured)
// Unattended-Upgrade::Mail "root";

// Enable logging
Unattended-Upgrade::SyslogEnable "true";
Unattended-Upgrade::SyslogFacility "daemon";
EOF

  # Enable automatic updates
  cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

  echo "  ✅ Automatic security updates configured"
  echo "    • Security updates will be installed daily"
  echo "    • System will auto-reboot at 2:00 AM if required"
  echo "    • Docker packages excluded (manual management recommended)"
  echo ""
}

# Function: Install Node.js and clone/update repository
install_node_and_workspace() {
  echo "📦 Installing Node.js and setting up workspace..."

  # Install Node.js 24 LTS via NodeSource
  echo "  Installing Node.js 24 LTS..."
  
  # Ensure universe repository is enabled (Ubuntu/Debian)
  echo "  Ensuring all repositories are available..."
  if [ -f /etc/apt/sources.list ]; then
    # Enable universe repository if it exists but is commented out
    sed -i 's/^# deb.*universe/deb http:\/\/archive.ubuntu.com\/ubuntu\/ focal universe/' /etc/apt/sources.list 2>/dev/null || true
  fi
  
  # Update package lists
  apt update
  
  # Install base packages with fallback
  echo "  Installing base packages..."
  apt install -y git curl
  
  # Try to install jq, if it fails, download it manually
  echo "  Installing jq..."
  set +e  # Temporarily disable exit on error
  apt install -y jq 2>/dev/null
  JQ_INSTALL_STATUS=$?
  set -e  # Re-enable exit on error
  
  if [ $JQ_INSTALL_STATUS -ne 0 ]; then
    echo "  ⚠️  jq not available via apt, downloading manually..."
    JQ_VERSION="1.8.1"
    curl -L "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-amd64" -o /usr/local/bin/jq
    chmod +x /usr/local/bin/jq
    echo "  ✅ jq installed manually"
  else
    echo "  ✅ jq installed via apt"
  fi
  
  # Now install Node.js
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt install -y nodejs

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
    cp .env "$BACKUP_DIR/" 2>/dev/null || true
    cp config.ts "$BACKUP_DIR/" 2>/dev/null || true
    
    # Check for uncommitted changes and stash them
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
      echo "    💾 Stashing local changes..."
      git stash push -m "Auto-stash during setup.sh update"
      STASHED=true
    else
      STASHED=false
    fi
    
    git fetch origin
    git checkout -B main origin/main
    
    # Restore stashed changes if any
    if [ "$STASHED" = true ]; then
      echo "    🔄 Restoring stashed changes..."
      git stash pop || echo "    ⚠️  Could not auto-apply stashed changes - check 'git stash list'"
    fi
    
    if [ -f "$BACKUP_DIR/.env" ]; then
      cp "$BACKUP_DIR/.env" .env
      echo "    ✅ Restored .env"
    fi
    
    if [ -f "$BACKUP_DIR/config.ts" ]; then
      cp "$BACKUP_DIR/config.ts" config.ts
      echo "    📦 Found legacy config.ts - migrating to new structure..."
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
    git clone https://github.com/jschirrmacher/swarm-config.git
    cd swarm-config
    echo "  ✅ Repository cloned"
  fi

  echo "  Installing npm dependencies..."
  export NUXT_TELEMETRY_DISABLED=1
  npm ci

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
configure_security_updates
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
