#!/bin/bash
# Step 1: Check if running as root

log_info "🔐 Step 1: Checking root privileges..."

if [ "$EUID" -ne 0 ]; then
  log_error "This script must be run as root"
  echo "Please run: curl -sSL https://raw.githubusercontent.com/jschirrmacher/swarm-config/next/scripts/setup.sh | sudo bash"
  exit 1
fi

log_info "✅ Running as root"
echo ""
