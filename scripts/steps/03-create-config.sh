#!/bin/bash
# Step 3: Create swarm-config configuration file

echo "📝 Step 3: Creating swarm-config configuration..."

CONFIG_FILE="/var/apps/swarm-config/.swarm-config"

if [ ! -f "$CONFIG_FILE" ]; then
  mkdir -p /var/apps/swarm-config
  
  cat > "$CONFIG_FILE" <<EOF
# Swarm Config Configuration
# Domain for this server
DOMAIN=$DOMAIN

# Generated on: $(date -Iseconds)
EOF
  
  chmod 644 "$CONFIG_FILE"
  echo "✅ Configuration file created: $CONFIG_FILE"
else
  echo "✅ Configuration file already exists"
fi

echo ""
