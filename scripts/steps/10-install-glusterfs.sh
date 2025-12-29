#!/bin/bash

echo "💾 Step 10: GlusterFS installation (optional)..."
echo "GlusterFS is needed for multi-node clusters with distributed storage."
echo "For single-node setups, you can skip this."
echo ""

read -p "Do you want to install GlusterFS? (y/N): " INSTALL_GLUSTER < /dev/tty

if [[ "$INSTALL_GLUSTER" =~ ^[Yy]$ ]]; then
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
