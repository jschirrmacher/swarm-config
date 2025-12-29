#!/bin/bash
# Swarm Config Setup Script
# Main orchestration script

set -e  # Exit on error

GITHUB_REPO="https://raw.githubusercontent.com/jschirrmacher/swarm-config/next"

# Always download files first when lib/common.sh is not accessible
# This handles both curl | bash and direct execution scenarios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)" || SCRIPT_DIR=""

if [ -z "$SCRIPT_DIR" ] || [ ! -f "$SCRIPT_DIR/lib/common.sh" ]; then
  # Running via stdin (curl | bash) or files not available
  echo "📦 Downloading setup files..."
  TEMP_DIR="/tmp/swarm-config-setup-$$"
  mkdir -p "$TEMP_DIR"/{lib,steps}
  
  echo "  → Downloading common library..."
  if ! curl -fsSL "$GITHUB_REPO/scripts/lib/common.sh" -o "$TEMP_DIR/lib/common.sh"; then
    echo "❌ Failed to download common.sh"
    exit 1
  fi
  
  echo "  → Downloading setup steps..."
  for step in 01-check-root 02-get-domain 03-create-config 04-install-docker 05-install-firewall 06-install-node-and-workspace 07-create-users 08-configure-ssh 09-create-network 10-deploy-kong 11-deploy-webui 12-install-glusterfs 13-migrate-legacy-apps 14-ensure-git-repos; do
    if ! curl -fsSL "$GITHUB_REPO/scripts/steps/${step}.sh" -o "$TEMP_DIR/steps/${step}.sh"; then
      echo "❌ Failed to download ${step}.sh"
      exit 1
    fi
  done
  
  SCRIPT_DIR="$TEMP_DIR"
  STEPS_DIR="$TEMP_DIR/steps"
  echo "✓ All files downloaded to $TEMP_DIR"
else
  # Files are available locally
  STEPS_DIR="$SCRIPT_DIR/steps"
  echo "✓ Using local files from $SCRIPT_DIR"
fi

# Verify common.sh exists before sourcing
if [ ! -f "$SCRIPT_DIR/lib/common.sh" ]; then
  echo "❌ Error: $SCRIPT_DIR/lib/common.sh not found"
  exit 1
fi

# Source common functions
source "$SCRIPT_DIR/lib/common.sh"

# Handle domain from command-line argument or environment variable
if [ -n "$1" ]; then
  export SWARM_DOMAIN="$1"
  echo "ℹ️  Using domain from argument: $SWARM_DOMAIN"
  echo ""
elif [ -n "$SWARM_DOMAIN" ]; then
  export SWARM_DOMAIN
  echo "ℹ️  Using domain from environment: $SWARM_DOMAIN"
  echo ""
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Swarm Config - Server Setup & Installation          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "This script will set up your server with:"
echo "  • Docker & Docker Swarm"
echo "  • UFW Firewall"
echo "  • Team user accounts from SSH keys"
echo "  • Kong API Gateway with Let's Encrypt SSL"
echo "  • Swarm Config Web UI"
echo "  • Optional: GlusterFS for distributed storage"
echo ""

# Execute all setup steps in order
for step_file in "$STEPS_DIR"/*.sh; do
  if [ -f "$step_file" ]; then
    source "$step_file"
  fi
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete! 🎉                    ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Services are now running:"
echo "  • Kong API Gateway: https://$DOMAIN"
echo "  • Web UI: https://config.$DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Access Web UI: https://config.$DOMAIN"
echo "  2. Create your first app repository"
echo "  3. Push your code: git push production main"
echo ""
echo "For team users:"
echo "  • Check ~/.swarm-config-password for Web UI credentials"
echo ""

# Cleanup temporary files if downloaded
if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi
echo "  • SSH access configured for all authorized_keys users"
echo ""
echo "📚 Documentation:"
echo "  • For app developers: /var/apps/swarm-config/docs/APP-DEVELOPER.md"
echo "  • For administrators: /var/apps/swarm-config/docs/ADMIN-SETUP.md"
echo "  • GitHub: https://github.com/jschirrmacher/swarm-config"
echo ""
