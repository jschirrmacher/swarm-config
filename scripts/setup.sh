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
    
    BACKUP_DIR=$(mktemp -d)
    cp .env "$BACKUP_DIR/" 2>/dev/null || true
    
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
      git stash push -m "Auto-stash during setup.sh"
    fi
    
    git fetch origin
    git checkout -B main origin/main
    
    [ -f "$BACKUP_DIR/.env" ] && cp "$BACKUP_DIR/.env" .env
    rm -rf "$BACKUP_DIR"
  else
    git clone https://github.com/jschirrmacher/swarm-config.git
    cd swarm-config
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
    echo "✅ Docker installed"
  fi
  
  if docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null | grep -q "active"; then
    echo "✅ Docker Swarm already initialized"
  else
    docker swarm init
    echo "✅ Docker Swarm initialized"
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
  
  TOKEN=$(openssl rand -hex 32)
  docker secret create host_manager_token - <<< "$TOKEN" 2>/dev/null || TOKEN=$(docker secret inspect host_manager_token --format '{{.Spec.Data}}' | base64 -d)
  
  docker run -d \
    --name host-manager-setup \
    --network host \
    -v /var/run/docker.sock:/var/run/docker.sock \
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
  export SWARM_DOMAIN="$1"
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Swarm Config - Server Setup & Installation          ║"
echo "╚════════════════════════════════════════════════════════════════╝"

check_root
clone_or_update_repo
install_docker
start_host_manager
run_setup

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete! 🎉                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Services are now running:"
echo "  • Kong API Gateway: https://$DOMAIN"
echo "  • Web UI: https://config.$DOMAIN"
echo ""
