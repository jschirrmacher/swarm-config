#!/bin/bash
# Initialize host-manager token for swarm-config
# This script creates a Docker secret with a secure random token

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔐 Host-Manager Token Setup"
echo "================================"
echo ""

# Check if running in Docker Swarm mode
if docker info 2>/dev/null | grep -q "Swarm: active"; then
  echo "✅ Docker Swarm is active"
  SWARM_MODE=true
else
  echo "ℹ️  Docker Swarm is not active (using Compose mode)"
  SWARM_MODE=false
fi

echo ""

if [ "$SWARM_MODE" = true ]; then
  # Docker Swarm mode - use secrets
  echo "📝 Creating Docker secret for production..."
  
  # Check if secret already exists
  if docker secret inspect host_manager_token >/dev/null 2>&1; then
    echo "⚠️  Secret 'host_manager_token' already exists!"
    echo ""
    read -p "Do you want to recreate it? This will require redeploying the stack. (y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "🗑️  Removing old secret..."
      docker secret rm host_manager_token
    else
      echo "❌ Aborted. Using existing secret."
      exit 0
    fi
  fi
  
  # Generate and create secret
  echo "🔑 Generating secure token..."
  TOKEN=$(openssl rand -hex 32)
  echo "$TOKEN" | docker secret create host_manager_token -
  
  echo ""
  echo "✅ Secret 'host_manager_token' created successfully!"
  echo ""
  echo "Next steps:"
  echo "1. Build images:"
  echo "   cd $PROJECT_DIR/host-manager && docker build -t host-manager:latest ."
  echo "   cd $PROJECT_DIR && docker build -t swarm-config-ui:latest ."
  echo ""
  echo "2. Deploy stack:"
  echo "   docker stack deploy -c compose.yaml swarm-config"
  
else
  # Docker Compose mode - use .env file
  echo "📝 Creating .env file for development..."
  
  ENV_FILE="$PROJECT_DIR/.env"
  
  if [ -f "$ENV_FILE" ] && grep -q "HOST_MANAGER_TOKEN" "$ENV_FILE"; then
    echo "⚠️  HOST_MANAGER_TOKEN already exists in .env file!"
    echo ""
    read -p "Do you want to regenerate it? (y/N) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      # Remove old token
      sed -i.bak '/HOST_MANAGER_TOKEN=/d' "$ENV_FILE"
      rm -f "$ENV_FILE.bak"
    else
      echo "❌ Aborted. Using existing token."
      exit 0
    fi
  fi
  
  # Generate and save token
  echo "🔑 Generating secure token..."
  TOKEN=$(openssl rand -hex 32)
  echo "HOST_MANAGER_TOKEN=$TOKEN" >> "$ENV_FILE"
  
  echo ""
  echo "✅ Token added to .env file!"
  echo ""
  echo "Next steps:"
  echo "1. Build images:"
  echo "   cd $PROJECT_DIR/host-manager && docker build -t host-manager:latest ."
  echo "   cd $PROJECT_DIR && docker build -t swarm-config-ui:latest ."
  echo ""
  echo "2. Start services:"
  echo "   docker compose up -d"
fi

echo ""
echo "📚 For more information, see: docs/SYSTEM-UPDATE.md"
