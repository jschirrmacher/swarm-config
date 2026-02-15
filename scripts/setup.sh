#!/bin/bash
set -e

check_root() {
  if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    exit 1
  fi
}

clone_or_update_repo() {
  echo "📦 Setting up workspace..."
  apt update && apt upgrade -y
  apt install -y git curl jq

  mkdir -p /var/apps
  cd /var/apps

  if [ -d "swarm-config" ]; then
    echo "  Updating existing installation..."
    cd swarm-config
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
    [[ "$REMOTE_URL" == git@github.com:* ]] && git remote set-url origin https://github.com/jschirrmacher/swarm-config.git
    git diff-index --quiet HEAD -- 2>/dev/null || git stash push -m "Auto-stash during setup.sh"
    git fetch origin
    if [ -n "$BRANCH" ]; then
      git checkout -B "$BRANCH" "origin/$BRANCH"
    else
      CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
      git pull origin "$CURRENT_BRANCH" 2>/dev/null || git pull origin main
    fi
  else
    git clone https://github.com/jschirrmacher/swarm-config.git
    cd swarm-config
    [ -n "$BRANCH" ] && [ "$BRANCH" != "main" ] && git checkout -b "$BRANCH" --track "origin/$BRANCH"
  fi
  
  # Set team group permissions
  chgrp -R team /var/apps/swarm-config
  chmod -R g+rwX /var/apps/swarm-config
  
  echo "✅ Repository ready"
}

install_docker() {
  echo "🐳 Installing Docker..."
  if command -v docker &> /dev/null; then
    echo "  Already installed"
  else
    apt install -y docker.io
    systemctl enable --now docker
  fi

  SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
  if [ "$SWARM_STATE" != "active" ]; then
    PRIMARY_IP=$(hostname -I | awk '{print $1}')
    docker swarm init --advertise-addr "$PRIMARY_IP"
  fi
  echo "✅ Docker Swarm ready"
}

configure_firewall() {
  echo "🔒 Configuring firewall..."
  apt install -y ufw
  ufw --force enable
  ufw allow 22/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  echo "✅ Firewall configured"
}

configure_auto_updates() {
  echo "🔄 Configuring automatic security updates..."
  apt install -y unattended-upgrades
  dpkg-reconfigure -f noninteractive unattended-upgrades
  echo "✅ Automatic security updates enabled"
}

create_users() {
  echo "👥 Creating team users from SSH keys..."
  if [ -f /root/.ssh/authorized_keys ]; then
    while IFS= read -r line; do
      [[ -z "$line" || "$line" == \#* ]] && continue
      USERNAME=$(echo "$line" | awk '{print $NF}' | sed 's/@.*//' | tr '[:upper:]' '[:lower:]')
      [[ -z "$USERNAME" ]] && continue
      if ! id "$USERNAME" &>/dev/null; then
        adduser --disabled-password --gecos "" "$USERNAME" 2>/dev/null || true
        usermod -aG docker,sudo,team "$USERNAME"
        echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$USERNAME"
        mkdir -p "/home/$USERNAME/.ssh"
        echo "$line" >> "/home/$USERNAME/.ssh/authorized_keys"
        chown -R "$USERNAME:$USERNAME" "/home/$USERNAME/.ssh"
        chmod 700 "/home/$USERNAME/.ssh"
        chmod 600 "/home/$USERNAME/.ssh/authorized_keys"
        echo "  Created user: $USERNAME"
      else
        # Add existing users to team group
        usermod -aG team "$USERNAME"
      fi
      fi
    done < /root/.ssh/authorized_keys
  fi
  echo "✅ Users configured"
}

create_git_user() {
  echo "🔧 Creating git user and team group..."
  
  # Create team group if it doesn't exist
  if ! getent group team &>/dev/null; then
    groupadd --gid 1000 team
    echo "  Created team group (GID 1000)"
  fi
  
  if ! id "git" &>/dev/null; then
    adduser --system --group --shell /bin/bash --home /home/git git
    usermod -aG team,docker git
    mkdir -p ~git/repos
    mkdir -p ~git/.ssh
    chmod 700 ~git/.ssh
    
    # Copy SSH keys from root for git access
    if [ -f /root/.ssh/authorized_keys ]; then
      cp /root/.ssh/authorized_keys ~git/.ssh/authorized_keys
      chmod 600 ~git/.ssh/authorized_keys
    fi
    
    chown -R git:team ~git/repos
    chmod -R g+rwX ~git/repos
    chown -R git:git ~git
    echo "  Created git user with repos at: ~git/repos"
  else
    echo "  Git user already exists"
    usermod -aG team,docker git
    mkdir -p ~git/repos
    chown -R git:team ~git/repos
    chmod -R g+rwX ~git/repos
  fi
  echo "✅ Git user and team group ready"
}

configure_ssh() {
  echo "🔐 Hardening SSH..."
  NON_ROOT_USERS=$(awk -F: '$3 >= 1000 && $1 != "nobody" {print $1}' /etc/passwd)
  if [ -z "$NON_ROOT_USERS" ]; then
    echo "  ⚠️  Skipping SSH hardening (no team users exist, would lock you out)"
    return
  fi
  sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
  sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  systemctl reload ssh sshd 2>/dev/null || true
  echo "✅ SSH hardened"
}

setup_kong_network() {
  echo "🌐 Creating Kong network..."
  docker network create --driver overlay --attachable kong-net 2>/dev/null || true
  echo "✅ Kong network ready"
}

build_and_deploy() {
  echo "🔨 Building and deploying..."
  cd /var/apps/swarm-config

  set -a; source .env; set +a

  npm install
  npm run kong:generate

  IMAGE_TAG=$(git rev-parse --short HEAD)
  if docker image inspect swarm-config-ui:${IMAGE_TAG} &>/dev/null; then
    echo "  Image swarm-config-ui:${IMAGE_TAG} already exists, skipping build"
  else
    docker build -t swarm-config-ui:${IMAGE_TAG} .
  fi

  IMAGE_TAG=${IMAGE_TAG} docker stack deploy --detach=true -c compose.yaml swarm-config

  echo "  Waiting for Kong to start..."
  RETRIES=0
  until docker exec $(docker ps --format '{{.Names}}' | grep _kong.1) kong health &>/dev/null; do
    RETRIES=$((RETRIES + 1))
    if [ $RETRIES -ge 30 ]; then
      echo "  ⚠️  Kong did not start within 60s – check logs: docker service logs swarm-config_kong"
      break
    fi
    sleep 2
  done
  npm run kong:reload 2>/dev/null || true

  echo "✅ Stack deployed"
}

# Load existing .env if present
ENV_FILE="/var/apps/swarm-config/.env"
[ -f "$ENV_FILE" ] && { set -a; source "$ENV_FILE"; set +a; }

# Override with command-line arguments if provided
[ -n "$1" ] && DOMAIN="$1"
[ -n "$2" ] && BRANCH="$2"

# Ask for missing values
if [ -z "$DOMAIN" ]; then
  read -rp "🌐 Domain name: " DOMAIN </dev/tty
fi
if [ -z "$DOMAIN" ] || ! echo "$DOMAIN" | grep -qP '^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$'; then
  echo "❌ Valid domain required (e.g. example.com)"
  exit 1
fi

if [ -z "$TECH_EMAIL" ]; then
  read -rp "📧 Email for Let's Encrypt certificates: " TECH_EMAIL </dev/tty
fi
if [ -z "$TECH_EMAIL" ]; then
  echo "❌ Email is required for SSL certificates"
  exit 1
fi

export DOMAIN BRANCH TECH_EMAIL

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║            Swarm Config - Server Setup                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo "📍 Domain: $DOMAIN"
echo ""

check_root
clone_or_update_repo
install_docker
configure_firewall
configure_auto_updates
create_users
create_git_user
configure_ssh
setup_kong_network

# Write .env
cd /var/apps/swarm-config
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
GIT_UID=$(id -u git)
TEAM_GID=$(getent group team | cut -d: -f3)
DOCKER_GID=$(getent group docker | cut -d: -f3)
cat > .env <<EOF
DOMAIN=${DOMAIN}
BRANCH=${BRANCH}
TECH_EMAIL=${TECH_EMAIL}
GIT_UID=${GIT_UID}
TEAM_GID=${TEAM_GID}
DOCKER_GID=${DOCKER_GID}
EOF

# Install Node.js if needed
if ! command -v node &> /dev/null; then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt install -y nodejs
fi

build_and_deploy

# Optional: SMTP configuration
if [ ! -f /etc/msmtprc ]; then
  echo ""
  read -rp "📧 Configure SMTP for sending emails? (y/N): " SETUP_SMTP </dev/tty
  if [[ "$SETUP_SMTP" =~ ^[yYjJ]$ ]]; then
    read -rp "  SMTP host: " SMTP_HOST </dev/tty
    read -rp "  SMTP port [587]: " SMTP_PORT </dev/tty
    SMTP_PORT="${SMTP_PORT:-587}"
    read -rp "  From address: " SMTP_FROM </dev/tty
    read -rp "  SMTP user: " SMTP_USER </dev/tty
    read -rsp "  SMTP password: " SMTP_PASS </dev/tty
    echo ""
    bash /var/apps/swarm-config/scripts/install-msmtp.sh "$SMTP_HOST" "$SMTP_PORT" "$SMTP_FROM" "$SMTP_USER" "$SMTP_PASS"
  fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    Installation Complete!                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🎉 Services running:"
echo "  • Kong Gateway: https://$DOMAIN"
echo "  • Web UI: https://config.$DOMAIN"
echo ""
