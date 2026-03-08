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

**Configuration variables** (set during installation):

- `$DOMAIN` - Your domain (e.g., example.com)
- `$WORKSPACE_BASE` - App workspaces (default: `/var/apps`)
- `$GIT_REPO_BASE` - Git repositories (default: `/home/git/repos`)

## Updates

Re-run the setup script. Your applications and data remain untouched:

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

## Web UI

Available at `https://config.$DOMAIN` after setup. Developers can create repositories self-service.

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
cd $WORKSPACE_BASE/swarm-config
./setup-hooks.sh $GIT_REPO_BASE
```

Or link manually:

```bash
ln -s $WORKSPACE_BASE/swarm-config/hooks/post-receive $GIT_REPO_BASE/<repo>.git/hooks/post-receive
```

### Updating Hooks

To update hooks after swarm-config changes:

```bash
cd $WORKSPACE_BASE/swarm-config
git pull
./setup-hooks.sh
```

This updates all repositories automatically.

## SMTP Configuration (Optional)

```bash
sudo bash $WORKSPACE_BASE/swarm-config/scripts/install-msmtp.sh smtp.example.com 587 noreply@example.com your-username your-password
```

Test: `echo "Test" | msmtp -a default recipient@example.com`

## Kong Configuration

Regenerate and reload after changes:

```bash
cd $WORKSPACE_BASE/swarm-config
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
sudo bash $WORKSPACE_BASE/swarm-config/scripts/install-glusterfs.sh server-2 server-3
```

The script installs GlusterFS, probes peers, and prints the remaining steps for volume creation and mounting.

## File Permissions & Multi-User Access

The system uses a **Shared Group Model with setgid** to allow git, Docker containers, and human users to collaborate on the same files.

### How It Works

All files belong to the **docker group** (GID from DOCKER_GID), and all users are members. The **setgid bit** ensures new files automatically inherit the docker group.

| Resource            | Owner | Group  | Mode | setgid |
| ------------------- | ----- | ------ | ---- | ------ |
| `$WORKSPACE_BASE/`  | root  | docker | 775  | ✓      |
| `$GIT_REPO_BASE/`   | root  | docker | 775  | ✓      |
| Git repositories    | git   | docker | 775  | ✓      |
| User workspaces     | user  | docker | 775  | ✓      |
| Files in repos      | git   | docker | 664  | -      |
| Files in workspaces | user  | docker | 664  | -      |

### Automatic Setup (Recommended)

Run the permissions setup script after initial installation:

```bash
cd /var/apps/swarm-config
sudo ./scripts/setup-permissions.sh
```

The script:

- Ensures docker group exists
- Adds git user to docker group
- Interactively adds more users
- Configures `/var/apps` and `/home/git/repos` with setgid bit
- Optionally fixes existing file permissions

After running the script, users must log out and back in for group membership to take effect.

### Manual Setup

If you prefer manual configuration:

```bash
# Add users to docker group
sudo usermod -aG docker git
sudo usermod -aG docker username

# Configure directories with setgid bit (use your actual paths)
sudo chown root:docker $WORKSPACE_BASE
sudo chmod 2775 $WORKSPACE_BASE

sudo chown root:docker $GIT_REPO_BASE
sudo chmod 2775 $GIT_REPO_BASE

# Fix existing permissions
sudo chgrp -R docker $WORKSPACE_BASE
sudo chmod -R g+rwX $WORKSPACE_BASE
sudo find $WORKSPACE_BASE -type d -exec chmod g+s {} \;
```

### Verification

```bash
# Check group membership
groups git

# Check directory permissions
ls -la $WORKSPACE_BASE

# Check setgid bit (should show 's')
stat -c '%A %n' $WORKSPACE_BASE
# Expected: drwxrwsr-x $WORKSPACE_BASE
```

### Troubleshooting

**"Permission denied" on git push:**

```bash
groups git  # Check if git is in docker group
sudo usermod -aG docker git  # Add if missing
sudo su - git -c exit  # Re-login git user
```

**Existing files have wrong permissions:**

```bash
cd $WORKSPACE_BASE
sudo chgrp -R docker .
sudo chmod -R g+rwX .
sudo find . -type d -exec chmod g+s {} \;
```

## Security

- SSH: Key-based authentication only (configured by setup.sh)
- Firewall: Only ports 22, 80, 443 open (+ Swarm ports for multi-node)
- SSL/TLS: Automatic via Kong ACME plugin
- Secrets: Only in `$WORKSPACE_BASE/<app>/.env`, never in Git

## Important Directories

```
$WORKSPACE_BASE/                # App data and .env files (default: /var/apps)
$GIT_REPO_BASE/<user>/<repo>.git/ # Bare Git repositories (default: /home/git/repos)
$WORKSPACE_BASE/swarm-config/   # Central configuration
/var/volumes/                   # GlusterFS mount (multi-node only)
```
