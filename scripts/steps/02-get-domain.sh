#!/bin/bash
# Step 2: Get domain configuration

echo "🌐 Step 2: Getting domain configuration..."

# Check if .swarm-config exists
if [ -f "/var/apps/swarm-config/.swarm-config" ]; then
  source /var/apps/swarm-config/.swarm-config
  echo "  Using existing domain: $DOMAIN"
elif [ -n "$SWARM_DOMAIN" ]; then
  # Use environment variable if provided
  DOMAIN="$SWARM_DOMAIN"
  echo "  Using domain from SWARM_DOMAIN: $DOMAIN"
else
  # Try to read from terminal if interactive
  if [ -t 0 ]; then
    read -p "Enter your domain name (e.g., example.com): " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
      echo "❌ Domain is required"
      exit 1
    fi
    
    echo "  Domain set to: $DOMAIN"
  else
    echo "❌ Domain is required but not provided"
    echo "   Run with: curl ... | sudo bash -s your-domain.com"
    echo "   Or interactively: sudo bash setup.sh"
    exit 1
  fi
fi

export DOMAIN
echo "✅ Domain configured: $DOMAIN"
echo ""
