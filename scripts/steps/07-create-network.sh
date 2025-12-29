#!/bin/bash

echo "🌐 Step 7: Creating Kong network..."

if docker network ls --filter name=kong-net --format '{{.Name}}' | grep -q '^kong-net$'; then
  echo "✅ kong-net network already exists"
else
  docker network create --scope=swarm --attachable -d overlay kong-net
  echo "✅ kong-net network created"
fi

echo ""
