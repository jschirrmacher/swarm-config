#!/bin/bash
# Step 8: Configure SSH security

echo "🔒 Step 8: Configuring SSH security..."

if [ -z "$USERNAMES" ]; then
  echo "⚠️  Skipping SSH security (no team users created)"
  echo ""
  return 0
fi

# Disable root login and password authentication
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config

# Ensure settings are present
if ! grep -q '^PermitRootLogin' /etc/ssh/sshd_config; then
  echo "" >> /etc/ssh/sshd_config
  echo "# Security settings added by setup" >> /etc/ssh/sshd_config
  echo "PermitRootLogin no" >> /etc/ssh/sshd_config
fi

if ! grep -q '^PasswordAuthentication' /etc/ssh/sshd_config; then
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
fi

# Restart SSH
service ssh restart

echo "✅ SSH security configured"
echo "⚠️  IMPORTANT: Test team user SSH access before closing this session!"
echo ""
