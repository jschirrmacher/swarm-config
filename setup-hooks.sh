#!/bin/bash
# Setup script to link post-receive hook to all managed repositories
# Usage: ./setup-hooks.sh [git-repos-base-path]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK_SOURCE="${SCRIPT_DIR}/hooks/post-receive"
GIT_BASE="${1:-/home/git/repos}"

if [ ! -f "$HOOK_SOURCE" ]; then
  echo "❌ Hook source not found: $HOOK_SOURCE"
  exit 1
fi

chmod +x "$HOOK_SOURCE"

echo "🔗 Setting up post-receive hooks"
echo "================================"
echo "Hook source: $HOOK_SOURCE"
echo "Git base: $GIT_BASE"
echo ""

link_hook() {
  local repo="$1"
  local name="$2"
  local hook_target="$repo/hooks/post-receive"

  [ -f "$hook_target" ] || [ -L "$hook_target" ] && rm "$hook_target"
  ln -s "$HOOK_SOURCE" "$hook_target"
  echo "✅ Linked: $name"
}

# Root-level repos (with or without .git suffix)
for repo in "$GIT_BASE"/*; do
  [ -d "$repo/hooks" ] || continue
  link_hook "$repo" "$(basename "$repo")"
done

# Namespace repos: <owner>/<repo>
for owner_dir in "$GIT_BASE"/*/; do
  [ -d "$owner_dir" ] || continue
  for repo in "$owner_dir"*/; do
    [ -d "$repo/hooks" ] || continue
    owner=$(basename "$owner_dir")
    link_hook "$repo" "$owner/$(basename "$repo")"
  done
done

echo ""
echo "✅ Setup completed"
