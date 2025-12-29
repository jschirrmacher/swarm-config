#!/bin/bash
# Swarm Config Setup Script
# Main orchestration script

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEPS_DIR="$SCRIPT_DIR/steps"

# Source common functions
source "$SCRIPT_DIR/lib/common.sh"

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
echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
sleep 5
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
echo "  • SSH access configured for all authorized_keys users"
echo ""
echo "📚 Documentation:"
echo "  • For app developers: /var/apps/swarm-config/docs/APP-DEVELOPER.md"
echo "  • For administrators: /var/apps/swarm-config/docs/ADMIN-SETUP.md"
echo "  • GitHub: https://github.com/jschirrmacher/swarm-config"
echo ""
