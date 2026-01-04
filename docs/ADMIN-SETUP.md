# Administrator Guide: Server Setup

This guide is for system administrators who want to set up a new server with Docker Swarm and Kong Gateway.

## Overview

The system consists of:

- **Docker Swarm** - Container orchestration
- **Kong Gateway** - API Gateway with automatic SSL/TLS
- **Swarm Config UI** - Web UI for repository and service management
- **Git-based CI/CD** - Automatic deployment

## Prerequisites

- Ubuntu/Debian server with root access
- At least 2 GB RAM

## Quick Start

### Step 1: Initial Setup (automated)

Use the automated setup script to install all base components:

```bash
# Direct download and execution
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

The script automatically performs the following steps:

- ✅ System updates
- ✅ Git installation
- ✅ Docker & Docker Swarm installation and initialization
- ✅ UFW Firewall configuration (ports 22, 80, 443, 9000)
- ✅ Node.js 24 LTS via NodeSource
- ✅ Create workspace `/var/apps`
- ✅ Clone repository
- ✅ Install npm dependencies
- ✅ Create team users (based on SSH authorized_keys)
- ✅ Configure SSH security (disables root login and password auth)
- ✅ Create Kong network
- ✅ Deploy Kong stack
- ✅ Build and deploy Web UI

**Note:** The setup.sh script:

- Interactively prompts for your domain and creates the `.swarm-config` file
- Creates the Kong network (`kong-net`)
- Generates the Kong configuration and automatically deploys the Kong stack
- Builds and deploys the Web UI for repository management
- Optionally prompts for GlusterFS installation (for multi-node clusters)

After setup, Kong and the Web UI are ready to use!

### Step 2: Web UI for Self-Service Repository Management

The Web UI was automatically installed by the setup.sh script and is available at:

**`https://config.your-domain.com`**

Developers can create self-service repositories there without requiring SSH access or admin rights.

#### Manually redeploy Web UI (if needed)

If the Web UI needs to be rebuilt:

```bash
cd /var/apps/swarm-config

# Rebuild Web UI
docker build -t swarm-config-ui:latest -f web-ui/Dockerfile .

# Redeploy stack
export DOMAIN=your-domain.com
docker stack deploy -c web-ui/docker-compose.yml swarm-config-ui

# Regenerate Kong config
npm run kong:generate
```

### Step 3: Configure Additional Services (Optional)

You can configure additional optional services:

#### Customize Kong Configuration (Optional)

### Generate Kong YAML

```bash
npm run kong:generate
```

### Deploy Swarm Config Stack

The complete stack (Kong, Redis, UI) is deployed via Docker Compose:

```bash
cd /var/apps/swarm-config
docker stack deploy -c compose.yaml swarm-config
```

**Important:** This command is automatically executed by the setup.sh script.

## Maintenance

### Update Kong Configuration

After changes in `config/`:

```bash
cd /var/apps/swarm-config
npm run kong:generate
```

Kong automatically reloads the configuration.

### Set Up Git Repository for New App

**Primary:** Use the Web UI at `https://config.your-domain.com`

**Alternative (Command Line):**

```bash
cd /var/apps/swarm-config
# Use the Web UI at https://config.yourdomain.com
# Or use the API directly
```

See [APP-DEVELOPER.md](./APP-DEVELOPER.md) for details

### Check Logs

```bash
# Kong Logs
docker service logs -f swarm-config_kong

# UI Logs
docker service logs -f swarm-config_ui

# Redis Logs
docker service logs -f swarm-config_redis

# All services in a stack
docker stack ps swarm-config
```

### Perform Updates

```bash
cd /var/apps/swarm-config
git pull
npm install
npm run kong:generate
```

## Troubleshooting

### Kong won't start

```bash
# Validate Kong configuration
docker exec $(docker ps -q -f name=kong) kong config parse /config/kong.yaml

# Check logs
docker service logs kong_kong
```

### Service is not reachable

```bash
# Check Kong routes
docker e# Check network
docker network ls
docker network inspect kong-net
```

## Multi-Node Cluster (Optional)

For production deployments with high availability and distributed storage, you can set up a multi-node Docker Swarm cluster with GlusterFS.

The `setup.sh` script prompts during installation whether GlusterFS should be installed and saves your decision in `.env`. You can change this later if needed.

**→ See [Multi-Node Cluster Setup Guide](./MULTI-NODE-SETUP.md) for complete instructions**

## Security

### Best Practices

1. **SSH**: Only key-based authentication
2. **Firewall**: Only open necessary ports (configured by setup.sh)
3. **SSL/TLS**: Kong ACME Plugin for automatic certificates
4. **Secrets**: Never commit to Git, only in `/var/apps/<app>/.env`

### Important Directories

```
/var/apps/                      # App data and .env files
/home/<user>/<repo>.git/        # Bare Git repositories in user home
/var/volumes/                   # GlusterFS mount (for multi-node)
/var/apps/swarm-config/         # Central configuration
```

## Additional Resources

- [APP-DEVELOPER.md](./APP-DEVELOPER.md) - For app developers
- [CONTRIBUTING.md](./CONTRIBUTING.md) - For swarm-config developers
- [Kong Documentation](https://docs.konghq.com/)
- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)
- [MULTI-NODE-SETUP.md](./MULTI-NODE-SETUP.md) - Multi-node cluster with GlusterFS
