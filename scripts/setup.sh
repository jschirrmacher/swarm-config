#!/bin/bash
# Bootstrap script: clones/updates repo, then hands off to the repo's own setup.sh
set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root"
  exit 1
fi

DOMAIN="$1"
BRANCH="${2:-main}"

apt update && apt install -y git curl

mkdir -p /var/apps
cd /var/apps

if [ -d "swarm-config" ]; then
  cd swarm-config
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  [[ "$REMOTE_URL" == git@github.com:* ]] && git remote set-url origin https://github.com/jschirrmacher/swarm-config.git
  git diff-index --quiet HEAD -- 2>/dev/null || git stash push -m "Auto-stash during setup"
  git fetch origin
  git checkout -B "$BRANCH" "origin/$BRANCH"
else
  git clone https://github.com/jschirrmacher/swarm-config.git
  cd swarm-config
  [ "$BRANCH" != "main" ] && git checkout -b "$BRANCH" --track "origin/$BRANCH"
fi

exec bash scripts/setup.sh "$DOMAIN" "$BRANCH"
