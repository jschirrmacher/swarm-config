#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ This script must be run as root"
  exit 1
fi

PEERS=("$@")

apt install -y glusterfs-server
systemctl enable --now glusterd

# Open Swarm and GlusterFS ports
if command -v ufw &>/dev/null; then
  ufw allow 2377/tcp   # Swarm cluster management
  ufw allow 4789/udp   # Swarm overlay network
  ufw allow 7946/tcp   # Swarm node communication
  ufw allow 7946/udp   # Swarm node communication
  ufw allow 24007/tcp  # GlusterFS daemon
  ufw allow 49152/tcp  # GlusterFS brick
fi

if [ ${#PEERS[@]} -gt 0 ]; then
  for peer in "${PEERS[@]}"; do
    gluster peer probe "$peer"
  done
  echo "✅ GlusterFS installed, peers probed: ${PEERS[*]}"
  echo ""
  echo "Next steps (on manager node):"
  echo "  gluster volume create storage-vol1 transport tcp \\"
  for peer in "$(hostname)" "${PEERS[@]}"; do
    echo "    $peer:/mnt/storage/brick \\"
  done
  echo ""
  echo "  gluster volume start storage-vol1"
  echo "  mkdir -p /var/volumes"
  echo "  mount -t glusterfs $(hostname):/storage-vol1 /var/volumes"
else
  echo "✅ GlusterFS installed (single node, no peers)"
  echo ""
  echo "To add peers later: gluster peer probe <hostname>"
fi
