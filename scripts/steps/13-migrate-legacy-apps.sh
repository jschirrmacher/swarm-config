#!/bin/bash
# Step 13: Migrate legacy apps to swarm-config

echo "🔄 Step 13: Migrating legacy apps to swarm-config..."

# Get all regular users from the system (skip root and system users)
mapfile -t AVAILABLE_USERS < <(awk -F: '$3 >= 1000 && $3 < 60000 && $1 != "nobody" {print $1}' /etc/passwd)

if [ ${#AVAILABLE_USERS[@]} -eq 0 ]; then
  echo "  ⚠️  No regular users found, skipping migration"
  echo ""
  return 0
fi

# Select user
SELECTED_USER=""
if [ ${#AVAILABLE_USERS[@]} -eq 1 ]; then
  SELECTED_USER="${AVAILABLE_USERS[0]}"
  echo "  Only one user found: $SELECTED_USER"
elif [ -t 0 ]; then
  # Interactive mode - let user choose
  echo "  Available users:"
  for i in "${!AVAILABLE_USERS[@]}"; do
    echo "    $((i+1)). ${AVAILABLE_USERS[$i]}"
  done
  echo ""
  read -p "  Select user (1-${#AVAILABLE_USERS[@]}): " user_choice
  
  if [[ "$user_choice" =~ ^[0-9]+$ ]] && [ "$user_choice" -ge 1 ] && [ "$user_choice" -le ${#AVAILABLE_USERS[@]} ]; then
    SELECTED_USER="${AVAILABLE_USERS[$((user_choice-1))]}"
  else
    echo "  ⚠️  Invalid selection, skipping migration"
    echo ""
    return 0
  fi
else
  # Non-interactive mode - use first user
  SELECTED_USER="${AVAILABLE_USERS[0]}"
fi

echo "  Using owner: $SELECTED_USER"

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
declare -a APPS_TO_UPDATE
for app_dir in "$WORKSPACE_BASE"/*; do
  if [ ! -d "$app_dir" ]; then continue; fi
  
  app_name=$(basename "$app_dir")
  
  # Skip special directories
  if [ "$app_name" = "swarm-config" ] || [ "$app_name" = "$SELECTED_USER" ]; then
    continue
  fi
  
  port=$(detect_port "$app_dir")
  created_at=$(stat -c %w "$app_dir" 2>/dev/null || stat -f %SB -t "%Y-%m-%dT%H:%M:%SZ" "$app_dir" 2>/dev/null || date -Iseconds)
  
  # Check if already has .repo-config.json
  if [ -f "$app_dir/.repo-config.json" ]; then
    # Check if it has an owner field
    owner=$(jq -r '.owner // empty' "$app_dir/.repo-config.json" 2>/dev/null || echo "")
    if [ -z "$owner" ] || [ "$owner" = "null" ]; then
      echo "  🔧 Config exists but missing owner: $app_name"
      APPS_TO_UPDATE+=("$app_name|$port|$created_at")
    else
      echo "  ✅ Already migrated: $app_name"
    fi
  else
    echo "  📦 Found app: $app_name (port: $port)"
    APPS_TO_MIGRATE+=("$app_name|$port|$created_at")
  fi
done

# Ask for confirmation
echo ""
echo "  📋 Found ${#APPS_TO_MIGRATE[@]} app(s) to migrate"
if [ ${#APPS_TO_UPDATE[@]} -gt 0 ]; then
  echo "  🔧 Found ${#APPS_TO_UPDATE[@]} app(s) to update (missing owner)"
fi
echo ""

if [ -t 0 ] && ([ ${#APPS_TO_MIGRATE[@]} -gt 0 ] || [ ${#APPS_TO_UPDATE[@]} -gt 0 ]); then
  # Interactive mode
  read -p "  Do you want to proceed? [Y/n] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]] && [[ -n $REPLY ]]; then
    echo "  ⏭️  Migration skipped"
    echo ""
    return 0
  fi
fi

# Perform migration for new apps
if [ ${#APPS_TO_MIGRATE[@]} -gt 0 ]; then
  echo "  Creating config files for new apps..."
fi

for app_data in "${APPS_TO_MIGRATE[@]}"; do
  IFS='|' read -r app_name port created_at <<< "$app_data"
  
  config_path="$WORKSPACE_BASE/$app_name/.repo-config.json"
  
  # Create .repo-config.json in workspace
  cat > "$config_path" << EOF
{
  "name": "$app_name",
  "port": $port,
  "owner": "$SELECTED_USER",
  "createdAt": "$created_at",
  "legacy": true
}
EOF
  
  chmod 644 "$config_path"
  echo "  ✅ Created: $config_path"
done

# Update existing configs without owner
if [ ${#APPS_TO_UPDATE[@]} -gt 0 ]; then
  echo "  Updating existing configs with missing owner..."
fi

for app_data in "${APPS_TO_UPDATE[@]}"; do
  IFS='|' read -r app_name port created_at <<< "$app_data"
  
  config_path="$WORKSPACE_BASE/$app_name/.repo-config.json"
  
  # Update .repo-config.json with owner field
  tmp_file=$(mktemp)
  jq --arg owner "$SELECTED_USER" '.owner = $owner' "$config_path" > "$tmp_file"
  mv "$tmp_file" "$config_path"
  chmod 644 "$config_path"
  echo "  ✅ Updated: $config_path"
done

echo ""
if [ ${#APPS_TO_MIGRATE[@]} -gt 0 ]; then
  echo "  ✅ Migration complete! Migrated ${#APPS_TO_MIGRATE[@]} app(s)"
fi
if [ ${#APPS_TO_UPDATE[@]} -gt 0 ]; then
  echo "  ✅ Updated ${#APPS_TO_UPDATE[@]} existing app(s)"
fi
if [ ${#APPS_TO_MIGRATE[@]} -gt 0 ] || [ ${#APPS_TO_UPDATE[@]} -gt 0 ]; then
  echo "  ℹ️  Run Step 14 to create Git repositories"
fi
echo ""
