#!/bin/bash
set -e

check_root() {
  if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    echo "Please run: sudo bash setup.sh"
    exit 1
  fi
}

clone_or_update_repo() {
  echo "📦 Setting up workspace..."
  
  apt update
  apt install -y git curl jq

  mkdir -p /var/apps
  cd /var/apps

  if [ -d "swarm-config" ]; then
    echo "⚠️  swarm-config exists, updating..."
    cd swarm-config
    
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [[ "$REMOTE_URL" == git@github.com:* ]]; then
      git remote set-url origin https://github.com/jschirrmacher/swarm-config.git
    fi
    
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
      echo "  💾 Stashing local changes..."
      git stash push -m "Auto-stash during setup.sh"
    fi
    
    git fetch origin
    git checkout -B "${BRANCH:-main}" "origin/${BRANCH:-main}"
  else
    git clone https://github.com/jschirrmacher/swarm-config.git
    cd swarm-config
    if [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ]; then
      git checkout -B "$BRANCH" "origin/$BRANCH"
    fi
  fi

  echo "✅ Repository ready"
}

install_docker() {
  echo "🐳 Installing Docker..."
  
  if command -v docker &> /dev/null; then
    echo "✅ Docker already installed"
  else
    apt update
    apt install -y docker.io
    systemctl enable docker
    systemctl start docker
    echo "✅ Docker installed"
  fi
  
  # Check Swarm status
  SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
  
  if [ "$SWARM_STATE" = "active" ]; then
    echo "✅ Docker Swarm already initialized"
  else
    echo "🔧 Initializing Docker Swarm..."
    
    # Get primary IP address
    PRIMARY_IP=$(hostname -I | awk '{print $1}')
    
    if [ -z "$PRIMARY_IP" ]; then
      echo "❌ Could not determine server IP address"
      exit 1
    fi
    
    echo "   Using IP address: $PRIMARY_IP"
    
    if docker swarm init --advertise-addr "$PRIMARY_IP"; then
      echo "✅ Docker Swarm initialized successfully"
    else
      echo "❌ Failed to initialize Docker Swarm"
      exit 1
    fi
  fi
  
  # Verify Swarm is working
  if docker node ls >/dev/null 2>&1; then
    echo "✅ Docker Swarm is operational"
  else
    echo "❌ Docker Swarm verification failed"
    exit 1
  fi
  
  # Ensure current user can use Docker
  if [ -n "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    echo "ℹ️  Note: You may need to log out and back in for Docker group membership to take effect"
  fi
}

start_host_manager() {
  echo "🚀 Starting host-manager..."
  cd /var/apps/swarm-config
  
  if ! docker images | grep -q "host-manager.*latest"; then
    echo "Building host-manager image..."
    docker build -t host-manager:latest ./host-manager
  fi
  
  if [ "$(docker ps -q -f name=host-manager-setup)" ]; then
    docker stop host-manager-setup
    docker rm host-manager-setup
  fi
  
  # Generate or retrieve existing token
  if docker secret inspect host_manager_token >/dev/null 2>&1; then
    # Secret exists, retrieve it
    TOKEN=$(docker secret inspect host_manager_token --format '{{.Spec.Data}}')
  else
    # Create new secret
    TOKEN=$(openssl rand -hex 32)
    echo "$TOKEN" | docker secret create host_manager_token -
  fi
  
  docker run -d \
    --name host-manager-setup \
    --network host \
    --cap-add SYS_ADMIN \
    --cap-add SYS_PTRACE \
    --security-opt apparmor=unconfined \
    --pid host \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /proc:/host/proc:ro \
    -e HOST_MANAGER_TOKEN="$TOKEN" \
    host-manager:latest
  
  echo "⏳ Waiting for host-manager to be ready..."
  for i in {1..30}; do
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
      echo "✅ host-manager is ready"
      export HOST_MANAGER_TOKEN="$TOKEN"
      return 0
    fi
    sleep 2
  done
  
  echo "❌ host-manager failed to start"
  docker logs host-manager-setup
  exit 1
}

run_setup() {
  echo "📋 Running setup via host-manager API..."
  
  # Pass DOMAIN and BRANCH to setup steps
  export DOMAIN="${DOMAIN:-}"
  export BRANCH="${BRANCH:-main}"
  
  curl -N -H "Authorization: Bearer $HOST_MANAGER_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{}' \
       http://localhost:3001/setup/run | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      echo "${line#data: }" | jq -r '.data.message // .data.error // empty' 2>/dev/null || true
    fi
  done
  
  echo ""
  echo "🧹 Cleaning up temporary host-manager container..."
  docker stop host-manager-setup
  docker rm host-manager-setup
}

if [ -n "$1" ]; then
  export DOMAIN="$1"
fi

if [ -n "$2" ]; then
  export BRANCH="$2"
else
  export BRANCH="main"
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Swarm Config - Server Setup & Installation          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo "📍 Domain: ${DOMAIN:-<not set>}"
echo "🌿 Branch: $BRANCH"
echo ""

check_root
clone_or_update_repo
install_docker
start_host_manager
run_setup

# Get DOMAIN from .env if not provided as argument
if [ -z "$DOMAIN" ] && [ -f /var/apps/swarm-config/.env ]; then
  DOMAIN=$(grep '^DOMAIN=' /var/apps/swarm-config/.env | cut -d'=' -f2)
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete! 🎉                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "🎉 Services are now running:"
  echo "  • Kong API Gateway: https://$DOMAIN"
  echo "  • Web UI: https://config.$DOMAIN"
  echo ""
  echo "Next steps:"
  echo "  1. Access Web UI: https://config.$DOMAIN"
  echo "  2. Complete manual setup steps (SMTP, GlusterFS, Apps)"
  echo "  3. Create your first app repository"
else
  echo "⚠️  DOMAIN not configured. Please set DOMAIN in /var/apps/swarm-config/.env"
fi
echo ""
