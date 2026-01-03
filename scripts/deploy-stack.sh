#!/bin/bash
# Deploy swarm-config stack with environment variables from .env

set -e

cd /var/apps/swarm-config

# Load environment variables from .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Deploy stack with DOMAIN variable
docker stack deploy --detach=true -c .swarm/docker-compose.yaml swarm-config

echo "✓ Stack deployed with DOMAIN=${DOMAIN}"
