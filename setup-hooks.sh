#!/bin/bash
# Setup script to link post-receive hook to all managed repositories
# Usage: ./setup-hooks.sh [git-repos-base-path]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SOURCE="${SCRIPT_DIR}/hooks/post-receive"
GIT_BASE="${1:-~git/repos}"

if [ ! -f "$HOOK_SOURCE" ]; then
  echo "❌ Hook source not found: $HOOK_SOURCE"
  exit 1
fi

echo "🔗 Setting up post-receive hooks"
echo "================================"
echo "Hook source: $HOOK_SOURCE"
echo "Git base: $GIT_BASE"
echo ""

# Find all bare repositories
for repo in "$GIT_BASE"/*.git; do
  if [ -d "$repo" ]; then
    REPO_NAME=$(basename "$repo" .git)
    HOOK_TARGET="$repo/hooks/post-receive"
    
    # Remove old hook if it exists
    if [ -f "$HOOK_TARGET" ] || [ -L "$HOOK_TARGET" ]; then
      rm "$HOOK_TARGET"
    fi
    
    # Create symlink
    ln -s "$HOOK_SOURCE" "$HOOK_TARGET"
    chmod +x "$HOOK_SOURCE"
    
    echo "✅ Linked: $REPO_NAME"
  fi
done

echo ""
echo "✅ Setup completed"
