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

# Step 1.5: Install and configure Docker
echo "📦 Step 1.5: Installing Docker..."
apt install -y docker.io

echo "✅ Docker installed"
echo ""

# Step 1.6: Initialize Docker Swarm
echo "🐳 Step 1.6: Initializing Docker Swarm..."
if docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q 'active'; then
  echo "✅ Docker Swarm already initialized"
else
  docker swarm init
  echo "✅ Docker Swarm initialized"
fi
echo ""

# Step 1.7: Install and configure UFW Firewall
echo "🔥 Step 1.7: Configuring UFW Firewall..."
apt install -y ufw

# Allow necessary ports
ufw allow ssh
ufw allow http
ufw allow https

# Enable firewall (non-interactive)
ufw --force enable

echo "✅ UFW Firewall configured (ports: 22, 80, 443, 9000)"
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
  
  # Ask for domain name - redirect from /dev/tty to work with curl | bash
  read -p "Enter your base domain (e.g., example.com): " DOMAIN < /dev/tty
  
  # Create .swarm-config with user input
  cat > .swarm-config << EOF
# Swarm Config - Server Configuration

# Base domain for your server
# Apps will be available at <appname>.<DOMAIN>
DOMAIN=${DOMAIN}
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

# Step 6: Create team users from SSH keys
echo "👥 Step 6: Creating team users from SSH authorized_keys..."

# Check if authorized_keys exists
if [ -f "/root/.ssh/authorized_keys" ]; then
  # Extract usernames from SSH keys (3rd field in each line)
  USERNAMES=$(grep -v '^#' /root/.ssh/authorized_keys | grep -v '^$' | awk '{print $3}' | sort -u)
  
  if [ -n "$USERNAMES" ]; then
    # Create team group if it doesn't exist
    if ! getent group team > /dev/null 2>&1; then
      addgroup team
      echo "  Created 'team' group"
    fi
    
    for USERNAME in $USERNAMES; do
      echo "  Setting up user: $USERNAME"
      
      # Create user if doesn't exist
      if ! id "$USERNAME" > /dev/null 2>&1; then
        adduser "$USERNAME" --ingroup team --disabled-password --gecos ""
      fi
      
      # Add to required groups
      usermod -aG sudo "$USERNAME"
      usermod -aG docker "$USERNAME"
      
      # Setup SSH directory
      mkdir -p "/home/$USERNAME/.ssh"
      chmod 700 "/home/$USERNAME/.ssh"
      
      # Copy authorized_keys
      cp /root/.ssh/authorized_keys "/home/$USERNAME/.ssh/authorized_keys"
      chmod 600 "/home/$USERNAME/.ssh/authorized_keys"
      chown -R "$USERNAME:team" "/home/$USERNAME/.ssh"
      
      echo "  ✅ User $USERNAME configured"
    done
    
    echo "✅ Team users created"
  else
    echo "⚠️  No usernames found in authorized_keys"
  fi
else
  echo "⚠️  /root/.ssh/authorized_keys not found, skipping team user creation"
fi
echo ""

# Step 7: Configure SSH security
echo "🔒 Step 7: Configuring SSH security..."

# Only configure SSH security if team users were created
if [ -n "$USERNAMES" ]; then
  # Disable root login and password authentication
  sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  
  # Ensure settings are present if not found
  if ! grep -q '^PermitRootLogin' /etc/ssh/sshd_config; then
    echo "" >> /etc/ssh/sshd_config
    echo "# Security settings added by initial-setup" >> /etc/ssh/sshd_config
    echo "PermitRootLogin no" >> /etc/ssh/sshd_config
  fi
  
  if ! grep -q '^PasswordAuthentication' /etc/ssh/sshd_config; then
    echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
  fi
  
  # Restart SSH service
  service ssh restart
  
  echo "✅ SSH security configured (root login and password auth disabled)"
  echo "⚠️  IMPORTANT: Make sure you can login with your team user before closing this session!"
else
  echo "⚠️  Skipping SSH security configuration (no team users created)"
fi
echo ""

# Step 8: Create Kong network
echo "🌐 Step 8: Creating Kong network..."

if docker network ls --filter name=kong-net --format '{{.Name}}' | grep -q '^kong-net$'; then
  echo "✅ kong-net network already exists"
else
  docker network create --scope=swarm --attachable -d overlay kong-net
  echo "✅ kong-net network created"
fi
echo ""

# Step 9: Generate Kong configuration and deploy stack
echo "🦍 Step 9: Generating Kong configuration and deploying Kong stack..."

cd /var/apps/swarm-config

# Generate Kong configuration
echo "  Generating Kong configuration..."
npm run kong:generate

# Deploy Kong stack
echo "  Deploying Kong stack..."
docker stack deploy -c config/stacks/kong.yaml kong

echo "✅ Kong stack deployed"
echo ""

# Step 10: Optional GlusterFS installation
echo "💾 Step 10: GlusterFS installation (optional)..."
echo "GlusterFS is needed for multi-node clusters with distributed storage."
echo "For single-node setups, you can skip this."
echo ""

read -p "Do you want to install GlusterFS? (y/N): " INSTALL_GLUSTER < /dev/tty

if [[ "$INSTALL_GLUSTER" =~ ^[Yy]$ ]]; then
  echo "  Installing GlusterFS..."
  apt install -y glusterfs-server
  systemctl enable glusterd
  systemctl start glusterd
  echo "✅ GlusterFS installed and started"
  echo "ℹ️  See docs/MULTI-NODE-SETUP.md for cluster configuration"
else
  echo "⏭️  Skipping GlusterFS installation"
fi
echo ""

# Final instructions
echo "✅ Initial setup complete!"
echo ""
echo "Kong API Gateway is now running!"
echo "Next steps:"
echo "1. Access Portainer (if deployed): https://your-domain:9000"
echo "2. Configure additional services in: /var/apps/swarm-config/config/services/"
echo "3. Regenerate Kong config after changes: cd /var/apps/swarm-config && npm run kong:generate"
echo "4. View Kong service status: docker service ls | grep kong"
