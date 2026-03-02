# Administrator Guide: Server Setup

## Prerequisites

- Ubuntu 22.04+ or Debian 12+ server with root access
- At least 2 GB RAM
- Domain name pointing to your server

## Installation

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

Optional: Use a specific branch:

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com v3
```

The script sets up: Docker Swarm, firewall (UFW), Node.js, team users (from SSH keys), SSH hardening, Kong Gateway, and the Web UI.

## Updates

Re-run the setup script. Your applications and data remain untouched:

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

## Web UI

Available at `https://config.your-domain.com` after setup. Developers can create repositories self-service.

## Git Hooks

Git hooks enable automatic deployment via `git push`. They are automatically set up by `setup-hooks.sh` during installation.

### How It Works

When developers push to a repository:

1. **Clone**: Checkout pushed commit to `/tmp/build-<version>`
2. **Build**: Build Docker image with tag `<appname>:<version>`
3. **Deploy**: Deploy stack via `docker stack deploy`
4. **Post-Deploy**: Execute `post-deploy.sh` if present (optional)
5. **Cleanup**: Remove temp directory

### Repository Requirements

Each app repository needs:

- `compose.yaml` in root (required)
- `Dockerfile` in root (optional, for custom builds)
- `post-deploy.sh` in root (optional, for post-deployment tasks)

### Manual Hook Setup

If you need to manually add hooks to a new repository:

```bash
cd /var/apps/swarm-config
./setup-hooks.sh /home/git/repos
```

Or link manually:

```bash
ln -s /var/apps/swarm-config/hooks/post-receive /home/git/repos/<repo>.git/hooks/post-receive
```

### Updating Hooks

To update hooks after swarm-config changes:

```bash
cd /var/apps/swarm-config
git pull
./setup-hooks.sh
```

This updates all repositories automatically.

## SMTP Configuration (Optional)

```bash
sudo bash /var/apps/swarm-config/scripts/install-msmtp.sh smtp.example.com 587 noreply@example.com your-username your-password
```

Test: `echo "Test" | msmtp -a default recipient@example.com`

## Kong Configuration

Regenerate and reload after changes:

```bash
cd /var/apps/swarm-config
npm run kong:generate
npm run kong:reload
```

## Logs

```bash
docker service logs -f swarm-config_kong     # Kong
docker service logs -f swarm-config_ui       # Web UI
docker stack ps swarm-config                 # All services
```

## Multi-Node Cluster (Optional)

### Setup

1. Initialize Swarm on the first node:

   ```bash
   docker swarm init --advertise-addr <IP>
   ```

2. Join workers with the displayed token:
   ```bash
   docker swarm join --token SWMTKN-1-xxxx... <MANAGER-IP>:2377
   ```

### GlusterFS (Distributed Storage)

Install on all nodes:

```bash
sudo bash /var/apps/swarm-config/scripts/install-glusterfs.sh server-2 server-3
```

The script installs GlusterFS, probes peers, and prints the remaining steps for volume creation and mounting.

## Security

- SSH: Key-based authentication only (configured by setup.sh)
- Firewall: Only ports 22, 80, 443 open (+ Swarm ports for multi-node)
- SSL/TLS: Automatic via Kong ACME plugin
- Secrets: Only in `/var/apps/<app>/.env`, never in Git

## Important Directories

```
/var/apps/                      # App data and .env files
/home/<user>/<repo>.git/        # Bare Git repositories
/var/apps/swarm-config/         # Central configuration
/var/volumes/                   # GlusterFS mount (multi-node only)
```
