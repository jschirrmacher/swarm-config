#!/bin/bash

echo "👥 Step 5: Creating team users from SSH authorized_keys..."

if [ ! -f "/root/.ssh/authorized_keys" ]; then
  echo "⚠️  /root/.ssh/authorized_keys not found, skipping team user creation"
  echo ""
  return 0
fi

# Extract and normalize usernames from SSH keys
RAW_USERNAMES=$(grep -v '^#' /root/.ssh/authorized_keys | grep -v '^$' | awk '{print $3}')

USERNAMES=""
for RAW_USER in $RAW_USERNAMES; do
  NORMALIZED=$(echo "$RAW_USER" | sed 's/[^a-zA-Z0-9_]//g' | tr '[:upper:]' '[:lower:]')
  
  if [[ "$NORMALIZED" =~ ^[a-z] ]] && [ -n "$NORMALIZED" ]; then
    if ! echo "$USERNAMES" | grep -q -w "$NORMALIZED"; then
      USERNAMES="$USERNAMES $NORMALIZED"
    fi
  else
    echo "  ⚠️  Skipping invalid username: $RAW_USER"
  fi
done

USERNAMES=$(echo "$USERNAMES" | xargs)

if [ -z "$USERNAMES" ]; then
  echo "⚠️  No valid usernames found"
  echo ""
  return 0
fi

# Create team group
if ! getent group team > /dev/null 2>&1; then
  addgroup team
  echo "  Created 'team' group"
fi

# Configure passwordless sudo
echo "%team ALL=(ALL:ALL) NOPASSWD:ALL" > /etc/sudoers.d/team
chmod 0440 /etc/sudoers.d/team
echo "  ✅ Passwordless sudo configured"

# Prepare directories
CONSUMERS_DIR="/var/apps/swarm-config/config/consumers"
DATA_DIR="/var/apps/swarm-config/data"
mkdir -p "$DATA_DIR"
PASSWORDS_FILE="$DATA_DIR/.passwords.txt"
> "$PASSWORDS_FILE"
chmod 600 "$PASSWORDS_FILE"

# Create each user
for USERNAME in $USERNAMES; do
  echo "  Setting up user: $USERNAME"
  
  # Create user
  if ! id "$USERNAME" > /dev/null 2>&1; then
    adduser "$USERNAME" --ingroup team --disabled-password --gecos ""
  fi
  
  # Add to groups
  usermod -aG sudo "$USERNAME"
  usermod -aG docker "$USERNAME"
  
  # Setup SSH
  mkdir -p "/home/$USERNAME/.ssh"
  chmod 700 "/home/$USERNAME/.ssh"
  
  # Copy only this user's SSH key from root's authorized_keys (case-insensitive)
  grep -i "@${USERNAME}\b" /root/.ssh/authorized_keys > "/home/$USERNAME/.ssh/authorized_keys" || \
  grep -i " ${USERNAME}$" /root/.ssh/authorized_keys > "/home/$USERNAME/.ssh/authorized_keys" || \
  grep -i " ${USERNAME}@" /root/.ssh/authorized_keys > "/home/$USERNAME/.ssh/authorized_keys" || true
  
  chmod 600 "/home/$USERNAME/.ssh/authorized_keys"
  chown -R "$USERNAME:team" "/home/$USERNAME/.ssh"
  
  # Generate Kong consumer
  PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
  CONSUMER_FILE="$CONSUMERS_DIR/${USERNAME}.ts"
  
  cat > "$CONSUMER_FILE" <<EOF
import type { Consumer } from "../../src/Consumer.js"

// Auto-generated consumer for SSH user: ${USERNAME}
// Generated on: $(date -Iseconds)
const consumer: Consumer = {
  username: "${USERNAME}",
  consumerName: "${USERNAME}",
  password: "${PASSWORD}"
}

export default consumer
EOF
  
  # Save password
  echo "${USERNAME}: ${PASSWORD}" >> "$PASSWORDS_FILE"
  
  # Save password to user's home
  USER_PASSWORD_FILE="/home/$USERNAME/.swarm-config-password"
  cat > "$USER_PASSWORD_FILE" <<EOF
# Swarm Config Web UI Password
# Generated on: $(date -Iseconds)
# Access the Web UI at: https://config.$DOMAIN

Username: ${USERNAME}
Password: ${PASSWORD}

# This password is for accessing:
# - Web UI: https://config.$DOMAIN
# - All services protected with basic-auth

# Keep this file secure!
EOF
  chmod 400 "$USER_PASSWORD_FILE"
  chown "$USERNAME:team" "$USER_PASSWORD_FILE"
  
  echo "  ✅ User $USERNAME configured"
  echo "     Password saved to /home/$USERNAME/.swarm-config-password"
done

echo "✅ Team users created: $USERNAMES"
echo "📋 Passwords saved to: $PASSWORDS_FILE"

# Export for SSH security step
export USERNAMES
echo ""
