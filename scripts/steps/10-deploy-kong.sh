#!/bin/bash
# Step 10: Deploy Kong API Gateway

echo "🦍 Step 10: Deploying Kong API Gateway..."

cd /var/apps/swarm-config

# Generate Kong configuration
echo "  Generating Kong configuration..."
npx tsx src/generate-kong-config.ts

# Deploy Kong stack
echo "  Deploying Kong stack..."
docker stack deploy --detach=false -c config/stacks/kong.yaml kong

# Wait for Kong to be ready
echo "  Waiting for Kong to be ready..."
RETRY_COUNT=0
MAX_RETRIES=30
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if docker service ls --filter name=kong_kong --format "{{.Replicas}}" | grep -q "1/1"; then
    echo "✅ Kong deployed and running"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "  Kong still starting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
  else
    echo "⚠️  Kong taking longer than expected"
    echo "  Check status: docker service ls | grep kong"
  fi
done

echo ""
