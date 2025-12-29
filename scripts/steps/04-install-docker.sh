#!/bin/bash
# Step 4: Install Docker and initialize Docker Swarm

echo "🐳 Step 4: Installing Docker and initializing Swarm..."

# Install Docker
echo "  Installing Docker..."
apt update
apt install -y docker.io

echo "  ✅ Docker installed"

# Initialize Docker Swarm
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")

if [ "$SWARM_STATE" = "active" ]; then
  echo "  ✅ Docker Swarm already initialized"
else
  echo "  Initializing Docker Swarm..."
  docker swarm init
  echo "  ✅ Docker Swarm initialized"
fi

echo "✅ Docker and Swarm ready"
echo ""
