#!/bin/bash
# Step 2: Get domain configuration

echo "🌐 Step 2: Getting domain configuration..."

# Check if .swarm-config exists
if [ -f "/var/apps/swarm-config/.swarm-config" ]; then
  source /var/apps/swarm-config/.swarm-config
  echo "  Using existing domain: $DOMAIN"
else
  # Get domain from user
  read -p "Enter your domain name (e.g., example.com): " DOMAIN
  
  if [ -z "$DOMAIN" ]; then
    echo "❌ Domain is required"
    exit 1
  fi
  
  echo "  Domain set to: $DOMAIN"
fi

export DOMAIN
echo "✅ Domain configured: $DOMAIN"
echo ""
