#!/bin/bash

echo "🔥 Step 4: Configuring UFW Firewall..."

apt install -y ufw

# Allow necessary ports
ufw allow ssh
ufw allow http
ufw allow https

# Enable firewall (non-interactive)
ufw --force enable

echo "✅ UFW Firewall configured (ports: 22, 80, 443)"
echo ""
