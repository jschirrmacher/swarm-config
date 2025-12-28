#!/bin/bash
# Pre-push hook for optional version bumping
# Asks before every push if version should be bumped
# Analyzes commit messages (Conventional Commits) to suggest appropriate bump type
#
# Installation:
#   cp scripts/pre-push.sh .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push

echo ""
echo "🚀 Pre-push: Version Management"
echo "================================"
echo ""

# Show current version
CURRENT_VERSION=$(npm run version:get --silent 2>/dev/null)
echo "Current version: v${CURRENT_VERSION}"

# Find last git tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -n "$LAST_TAG" ]; then
  echo "Last tag: ${LAST_TAG}"
  echo ""
  
  # Analyze commits since last tag
  COMMITS=$(git log ${LAST_TAG}..HEAD --pretty=format:"%s" 2>/dev/null)
  
  if [ -n "$COMMITS" ]; then
    echo "📝 Analyzing commits since ${LAST_TAG}..."
    
    SUGGESTED_BUMP="no"
    HAS_BREAKING=false
    HAS_FEAT=false
    HAS_FIX=false
    
    while IFS= read -r commit; do
      # Check for breaking changes
      if echo "$commit" | grep -qiE "^(feat|fix|chore|docs|style|refactor|perf|test)!:|BREAKING CHANGE"; then
        HAS_BREAKING=true
      # Check for features
      elif echo "$commit" | grep -qiE "^feat(\(.+\))?:"; then
        HAS_FEAT=true
      # Check for fixes
      elif echo "$commit" | grep -qiE "^fix(\(.+\))?:"; then
        HAS_FIX=true
      fi
    done <<< "$COMMITS"
    
    # Determine suggested bump (highest priority wins)
    if [ "$HAS_BREAKING" = true ]; then
      SUGGESTED_BUMP="major"
      echo "   🔴 Breaking changes detected → suggest MAJOR bump"
    elif [ "$HAS_FEAT" = true ]; then
      SUGGESTED_BUMP="minor"
      echo "   🟡 New features detected → suggest MINOR bump"
    elif [ "$HAS_FIX" = true ]; then
      SUGGESTED_BUMP="patch"
      echo "   🟢 Bug fixes detected → suggest PATCH bump"
    else
      echo "   ℹ️  No conventional commits found"
    fi
    
    echo ""
  fi
else
  echo "No previous tags found"
  echo ""
fi

# Ask user if they want to bump version
echo "Bump version before push?"
echo "  [major] - Breaking changes (${CURRENT_VERSION} → $(echo $CURRENT_VERSION | awk -F. '{print $1+1 ".0.0"}')"
echo "  [minor] - New features (${CURRENT_VERSION} → $(echo $CURRENT_VERSION | awk -F. '{print $1 "." $2+1 ".0"}')"
echo "  [patch] - Bug fixes (${CURRENT_VERSION} → $(echo $CURRENT_VERSION | awk -F. '{print $1 "." $2 "." $3+1}')"
echo "  [no]    - Skip version bump"
echo ""

if [ "$SUGGESTED_BUMP" != "no" ] && [ -n "$SUGGESTED_BUMP" ]; then
  read -p "Your choice [${SUGGESTED_BUMP}]: " BUMP < /dev/tty
  BUMP=${BUMP:-$SUGGESTED_BUMP}  # Use suggestion as default
else
  read -p "Your choice [no]: " BUMP < /dev/tty
  BUMP=${BUMP:-no}  # Default to 'no' if empty
fi

if [[ "$BUMP" =~ ^(major|minor|patch)$ ]]; then
  echo ""
  echo "⬆️  Bumping version ($BUMP)..."
  
  # Bump version
  npm run version:bump $BUMP
  
  # Get new version
  NEW_VERSION=$(npm run version:get --silent 2>/dev/null)
  
  # Stage the changed package.json
  git add package.json
  
  # Commit the version change
  git commit -m "chore: bump version to ${NEW_VERSION}"
  
  # Create git tag
  npm run version:tag
  
  echo ""
  echo "✅ Version bumped: v${CURRENT_VERSION} → v${NEW_VERSION}"
  echo "   Git tag v${NEW_VERSION} created"
  echo ""
  
  # Extract remote from push command
  REMOTE_NAME=$(git remote | head -n 1)
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  
  echo "🔄 Pushing version commit and tag..."
  echo ""
  
  # Push both the new commit and all tags
  echo "📤 Pushing ${CURRENT_BRANCH} and tags to ${REMOTE_NAME}..."
  if git push ${REMOTE_NAME} ${CURRENT_BRANCH} --tags; then
    echo ""
    echo "✅ Successfully pushed version ${NEW_VERSION} and tag"
    echo ""
  else
    echo ""
    echo "❌ Failed to push version and tag"
    exit 1
  fi
elif [[ "$BUMP" == "no" ]] || [[ -z "$BUMP" ]]; then
  echo ""
  echo "⏭️  Skipping version bump"
  echo ""
else
  echo ""
  echo "❌ Invalid choice. Aborting push."
  exit 1
fi

# Continue with push
exit 0
