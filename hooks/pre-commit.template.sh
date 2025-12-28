#!/bin/bash
# Pre-commit hook template for Go projects
# Formats staged files before commit
#
# Customize PROJECT_NAME if needed

PROJECT_NAME="${PROJECT_NAME:-${PWD##*/}}"

echo "🎨 Formatting staged files for ${PROJECT_NAME}..."

# Get list of staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|js|vue|json|md)$' || true)

if [ -z "$STAGED_FILES" ]; then
  echo "   No files to format"
  exit 0
fi

# Format staged files
echo "$STAGED_FILES" | xargs npx prettier --write --ignore-unknown

# Re-add formatted files to staging area
echo "$STAGED_FILES" | xargs git add

echo "✅ Files formatted and re-staged"
exit 0
