#!/bin/bash
# Step 13: Migrate legacy apps to swarm-config

echo "🔄 Step 13: Migrating legacy apps to swarm-config..."

# Get the first user from the system (skip root and system users)
FIRST_USER=$(awk -F: '$3 >= 1000 && $3 < 60000 && $1 != "nobody" {print $1; exit}' /etc/passwd)

if [ -z "$FIRST_USER" ]; then
  echo "  ⚠️  No regular user found, skipping migration"
  echo ""
  return 0
fi

echo "  Using owner: $FIRST_USER"

WORKSPACE_BASE="${WORKSPACE_BASE:-/var/apps}"

# Check if there are any potential legacy apps
LEGACY_COUNT=$(find "$WORKSPACE_BASE" -maxdepth 1 -type d ! -name "swarm-config" ! -name "$FIRST_USER" ! -path "$WORKSPACE_BASE" 2>/dev/null | wc -l)

if [ "$LEGACY_COUNT" -eq 0 ]; then
  echo "  ℹ️  No legacy apps found in $WORKSPACE_BASE"
  echo ""
  return 0
fi

echo "  Found $LEGACY_COUNT potential legacy app(s)"

# Function to detect port from app directory
detect_port() {
  local app_dir="$1"
  local port=3000
  
  # Check .env file
  if [ -f "$app_dir/.env" ]; then
    local env_port=$(grep -E "^PORT=" "$app_dir/.env" 2>/dev/null | cut -d= -f2)
    if [ -n "$env_port" ]; then
      echo "$env_port"
      return
    fi
  fi
  
  # Check docker-compose files
  for compose_file in "$app_dir/docker-compose.yml" "$app_dir/docker-compose.yaml"; do
    if [ -f "$compose_file" ]; then
      local compose_port=$(grep -E "- \"[0-9]+:" "$compose_file" 2>/dev/null | head -1 | sed -E 's/.*"([0-9]+):.*/\1/')
      if [ -n "$compose_port" ]; then
        echo "$compose_port"
        return
      fi
    fi
  done
  
  # Check package.json
  if [ -f "$app_dir/package.json" ]; then
    local pkg_port=$(grep -E "\"port\":\s*[0-9]+" "$app_dir/package.json" 2>/dev/null | sed -E 's/.*"port":\s*([0-9]+).*/\1/')
    if [ -n "$pkg_port" ]; then
      echo "$pkg_port"
      return
    fi
  fi
  
  echo "$port"
}

# Scan and preview apps
echo "  Scanning for apps..."
declare -a APPS_TO_MIGRATE
for app_dir in "$WORKSPACE_BASE"/*; do
  if [ ! -d "$app_dir" ]; then continue; fi
  
  app_name=$(basename "$app_dir")
  
  # Skip special directories
  if [ "$app_name" = "swarm-config" ] || [ "$app_name" = "$FIRST_USER" ]; then
    continue
  fi
  
  # Skip if already has .repo-config.json
  if [ -f "$app_dir/.repo-config.json" ]; then
    echo "  ✅ Already migrated: $app_name"
    continue
  fi
  
  port=$(detect_port "$app_dir")
  created_at=$(stat -c %w "$app_dir" 2>/dev/null || stat -f %SB -t "%Y-%m-%dT%H:%M:%SZ" "$app_dir" 2>/dev/null || date -Iseconds)
  
  echo "  📦 Found app: $app_name (port: $port)"
  APPS_TO_MIGRATE+=("$app_name|$port|$created_at")
done

# Ask for confirmation
echo ""
echo "  📋 Found ${#APPS_TO_MIGRATE[@]} app(s) to migrate"
echo ""

if [ -t 0 ]; then
  # Interactive mode
  read -p "  Do you want to proceed with the migration? [Y/n] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ -n $REPLY ]]; then
    echo "  ⏭️  Migration skipped"
    echo ""
    return 0
  fi
fi

# Perform migration
echo "  Performing migration..."
for app_data in "${APPS_TO_MIGRATE[@]}"; do
  IFS='|' read -r app_name port created_at <<< "$app_data"
  
  config_path="$WORKSPACE_BASE/$app_name/.repo-config.json"
  
  cat > "$config_path" << EOF
{
  "name": "$app_name",
  "port": $port,
  "owner": "$FIRST_USER",
  "createdAt": "$created_at",
  "legacy": true
}
EOF
  
  chmod 644 "$config_path"
  echo "  ✅ Created: $config_path"
done

echo ""
echo "  ✅ Migration complete! Migrated ${#APPS_TO_MIGRATE[@]} app(s)"
echo ""
