#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SWARM_CONFIG_DIR="$(dirname "$SCRIPT_DIR")"

cd "$SWARM_CONFIG_DIR"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Swarm Config - Quick Stack Update                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ -f .env ]; then
  echo "📝 Loading configuration from .env..."
  export $(grep -v '^#' .env | xargs)
  BRANCH="${BRANCH:-main}"
else
  if [ -z "$1" ]; then
    echo "❌ No .env file found - domain parameter required!"
    echo "Usage: $0 <domain>"
    exit 1
  fi
  DOMAIN="$1"
  BRANCH="${2:-main}"
  cat > .env <<EOF
DOMAIN=${DOMAIN}
BRANCH=${BRANCH}
EOF
fi

if [ -z "$DOMAIN" ]; then
  echo "❌ DOMAIN not configured!"
  exit 1
fi

echo "   Domain: ${DOMAIN}"
echo ""

echo "→ Pulling latest changes..."
git pull
echo "✓ Repository updated"
echo ""

COMMIT_ID=$(git rev-parse HEAD | cut -c1-8)
echo "📋 Commit ID: $COMMIT_ID"
echo ""

echo "→ Building swarm-config-ui..."
if docker image inspect swarm-config-ui:${COMMIT_ID} &>/dev/null; then
  echo "  Image swarm-config-ui:${COMMIT_ID} already exists, skipping build"
else
  docker build --pull --no-cache -t swarm-config-ui:${COMMIT_ID} .
fi
echo "✓ swarm-config-ui ready"
echo ""

echo "🔄 Updating swarm-config stack..."
IMAGE_TAG=${COMMIT_ID} docker stack deploy --detach=true -c compose.yaml swarm-config
echo "✓ Stack updated"
echo ""

echo "⏳ Waiting for services to stabilize (10s)..."
sleep 10

echo "→ Regenerating Kong configuration..."
npm run kong:generate
npm run kong:reload
echo "✓ Kong configuration updated"
echo ""

echo ""
echo "✅ Stack update complete!"
echo "   Access UI: https://config.${DOMAIN}"
echo ""
