#!/bin/bash
# Step 6: Install Node.js and clone/update repository

echo "📦 Step 6: Installing Node.js and setting up workspace..."

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
  
  # Ensure correct ownership first (fixes git dubious ownership warning)
  chown -R root:root /var/apps/swarm-config
  
  cd swarm-config
  
  # Switch SSH to HTTPS if needed
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if [[ "$REMOTE_URL" == git@github.com:* ]]; then
    echo "    🔄 Switching remote URL from SSH to HTTPS..."
    git remote set-url origin https://github.com/jschirrmacher/swarm-config.git
  fi
  
  # Backup local configuration
  BACKUP_DIR=$(mktemp -d)
  echo "    📦 Backing up local configuration..."
  cp -r config "$BACKUP_DIR/" 2>/dev/null || true
  cp .swarm-config "$BACKUP_DIR/" 2>/dev/null || true
  cp config.ts "$BACKUP_DIR/" 2>/dev/null || true
  
  # Update repository
  git fetch origin next
  git reset --hard origin/next
  
  # Restore .swarm-config
  if [ -f "$BACKUP_DIR/.swarm-config" ]; then
    cp "$BACKUP_DIR/.swarm-config" .swarm-config
    echo "    ✅ Restored .swarm-config"
  fi
  
  # Migrate legacy config.ts if it exists
  if [ -f "$BACKUP_DIR/config.ts" ]; then
    cp "$BACKUP_DIR/config.ts" config.ts
    echo "    📦 Found legacy config.ts - migrating..."
    npx tsx src/migrate-config.ts || echo "    ⚠️  Migration failed - manual migration required"
  fi
  
  # Restore local-only files
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

# Install dependencies
echo "  Installing npm dependencies..."
export NUXT_TELEMETRY_DISABLED=1
npm install

echo "✅ Workspace ready"
echo ""
