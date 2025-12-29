#!/bin/bash

echo "🐳 Step 2: Installing Docker and initializing Swarm..."

# Check if Docker is already installed and working
if command -v docker &> /dev/null && docker ps &> /dev/null; then
  DOCKER_VERSION=$(docker --version)
  echo "  ✅ Docker already installed and running: $DOCKER_VERSION"
  
  # Check if there are running containers
  RUNNING_CONTAINERS=$(docker ps -q | wc -l)
  if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    echo "  ℹ️  Found $RUNNING_CONTAINERS running container(s)"
  fi
else
  # Docker not working or not installed
  if dpkg -l | grep -qE 'containerd|docker'; then
    echo "  ⚠️  Found conflicting Docker packages"
    echo "  Removing conflicting packages (data in /var/lib/docker will be preserved)..."
    apt remove -y containerd docker docker-engine docker.io runc 2>/dev/null || true
  fi
  
  # Install Docker
  echo "  Installing Docker..."
  apt update
  apt install -y docker.io
  
  echo "  ✅ Docker installed"
fi

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
