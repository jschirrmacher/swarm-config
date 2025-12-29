#!/bin/bash
# Step 11: Build and deploy Web UI

echo "🎨 Step 11: Building and deploying Swarm Config Web UI..."

cd /var/apps/swarm-config

# Build Docker image
echo "  Building Web UI Docker image..."
docker build -t swarm-config-ui:latest . || {
  echo "⚠️  Web UI build failed, but continuing..."
  echo "  Build it manually: cd /var/apps/swarm-config && docker build -t swarm-config-ui:latest ."
  echo ""
  return 0
}

if ! docker images | grep -q swarm-config-ui; then
  echo "⚠️  Web UI image not available"
  echo ""
  return 0
fi

# Distribute image to swarm nodes
echo "  Distributing image to all swarm nodes..."
docker save swarm-config-ui:latest | docker load

# Copy to worker nodes if they exist
worker_nodes=$(docker node ls --filter role=worker -q 2>/dev/null || true)
if [ -n "$worker_nodes" ]; then
  echo "  Copying image to worker nodes..."
  for node in $worker_nodes; do
    node_ip=$(docker node inspect "$node" --format '{{.Status.Addr}}' 2>/dev/null || true)
    if [ -n "$node_ip" ]; then
      echo "    → $node_ip"
      docker save swarm-config-ui:latest | ssh "$node_ip" docker load 2>/dev/null || true
    fi
  done
fi

# Deploy stack
echo "  Deploying Web UI stack..."
# Load domain from .swarm-config
if [ -f /var/apps/swarm-config/.swarm-config ]; then
  source /var/apps/swarm-config/.swarm-config
fi
export DOMAIN
docker stack deploy --detach=true -c config/stacks/swarm-config-ui.yaml swarm-config

# Force update service
echo "  Updating service with new image..."
docker service update --image swarm-config-ui:latest --force swarm-config_ui 2>/dev/null || true

# Regenerate Kong config
echo "  Regenerating Kong configuration..."
npx tsx src/generate-kong-config.ts
npx tsx src/reload-kong.ts

echo "✅ Web UI deployed"
echo "  Access at: https://config.$DOMAIN"
echo ""
