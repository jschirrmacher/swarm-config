#!/bin/bash

echo "[STEP:START:09-install-glusterfs]"
echo "💾 Step 9: GlusterFS installation (optional)..."

# Check if decision is already saved in .env
if [ -f "/var/apps/swarm-config/.env" ]; then
  source /var/apps/swarm-config/.env
fi

if [ -z "$INSTALL_GLUSTERFS" ]; then
  echo "GlusterFS is needed for multi-node clusters with distributed storage."
  echo "For single-node setups, you can skip this."
  echo ""
  read -p "Do you want to install GlusterFS? (y/N): " INSTALL_GLUSTER < /dev/tty
  
  # Save decision to .env
  if [[ "$INSTALL_GLUSTER" =~ ^[Yy]$ ]]; then
    echo "INSTALL_GLUSTERFS=true" >> /var/apps/swarm-config/.env
    INSTALL_GLUSTERFS=true
  else
    echo "INSTALL_GLUSTERFS=false" >> /var/apps/swarm-config/.env
    INSTALL_GLUSTERFS=false
  fi
else
  echo "  Using saved preference from .env: INSTALL_GLUSTERFS=$INSTALL_GLUSTERFS"
fi

if [ "$INSTALL_GLUSTERFS" = "true" ]; then
  echo "  Installing GlusterFS..."
  apt install -y glusterfs-server
  systemctl enable glusterd
  systemctl start glusterd
  echo "✅ GlusterFS installed and started"
  echo "ℹ️  See docs/MULTI-NODE-SETUP.md for cluster configuration"
else
  echo "⏭️  Skipping GlusterFS installation"
fi

echo ""
echo "[STEP:COMPLETE:09-install-glusterfs]"
