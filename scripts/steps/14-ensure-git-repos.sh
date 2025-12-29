#!/bin/bash
# Step 14: Ensure Git repositories exist for all apps

echo "🔍 Step 14: Ensuring Git repositories for all apps..."

WORKSPACE_BASE="${WORKSPACE_BASE:-/var/apps}"
REPOS_BASE="${GIT_REPO_BASE:-/home}"
SWARM_CONFIG_DIR="${SWARM_CONFIG_DIR:-/var/apps/swarm-config}"

# Find all apps with .repo-config.json
echo "  Scanning for apps with configuration..."
declare -a APPS_TO_CHECK
declare -a APPS_TO_FIX

for app_dir in "$WORKSPACE_BASE"/*; do
  if [ ! -d "$app_dir" ]; then continue; fi
  
  app_name=$(basename "$app_dir")
  
  # Skip special directories
  if [ "$app_name" = "swarm-config" ]; then
    continue
  fi
  
  # Only process apps with .repo-config.json
  if [ -f "$app_dir/.repo-config.json" ]; then
    owner=$(jq -r '.owner // empty' "$app_dir/.repo-config.json" 2>/dev/null || echo "")
    if [ -z "$owner" ] || [ "$owner" = "null" ]; then
      echo "  📦 Found app without owner: $app_name"
      APPS_TO_FIX+=("$app_name")
    else
      echo "  📦 Found app: $app_name (owner: $owner)"
      APPS_TO_CHECK+=("$app_name|$owner")
    fi
  fi
done

# Handle apps without owner if any found
if [ ${#APPS_TO_FIX[@]} -gt 0 ]; then
  echo ""
  echo "  ⚠️  Found ${#APPS_TO_FIX[@]} app(s) without owner:"
  for app_name in "${APPS_TO_FIX[@]}"; do
    echo "      - $app_name"
  done
  echo ""
  echo "  Please run Step 13 (migrate-legacy-apps.sh) first to set owners."
  echo "  Or manually add 'owner' field to .repo-config.json files."
  echo ""
fi

# Check and create repositories
created_count=0
exists_count=0

for app_data in "${APPS_TO_CHECK[@]}"; do
  IFS='|' read -r app_name owner <<< "$app_data"
  
  repo_path="$REPOS_BASE/$owner/${app_name}.git"
  
  if [ ! -d "$repo_path" ]; then
    echo "  📁 Creating git repository: $repo_path"
    mkdir -p "$(dirname "$repo_path")"
    git init --bare "$repo_path"
    
    # Copy post-receive hook if available
    if [ -f "$SWARM_CONFIG_DIR/hooks/post-receive" ]; then
      cp "$SWARM_CONFIG_DIR/hooks/post-receive" "$repo_path/hooks/"
      chmod +x "$repo_path/hooks/post-receive"
      echo "  🪝 Installed post-receive hook"
    fi
    
    # Set ownership
    chown -R "$owner" "$repo_path" 2>/dev/null || true
    echo "  ✅ Repository created for $app_name"
    ((created_count++))
  else
    echo "  ✓ Repository exists: $app_name"
    ((exists_count++))
  fi
done

echo ""
if [ $created_count -gt 0 ]; then
  echo "  ✅ Created $created_count new repository/repositories"
fi
if [ $exists_count -gt 0 ]; then
  echo "  ℹ️  $exists_count repository/repositories already existed"
fi
echo ""
