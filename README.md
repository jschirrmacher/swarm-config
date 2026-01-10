# swarm-config

Complete Docker Swarm infrastructure with Kong API Gateway and Git-based CI/CD deployment platform.

## Features

- 🐳 **Docker Swarm** - Single- or multi-node cluster orchestration
- 🦍 **Kong Gateway** - API Gateway with automatic SSL/TLS via Let's Encrypt
- 🚀 **Git-based CI/CD** - Deploy apps with `git push production main`
- 📊 **Monitoring** - Prometheus & Grafana
- 🎛️ **Portainer** - Web UI for container management
- 🔧 **Automated Setup** - One-command installation script

## Quick Start for Administrators

### Requirements

- **Operating System**: Ubuntu 20.04+ or Debian 11+ (uses `apt`, `ufw`, `adduser`)
- **Root Access**: Setup script must run as root
- **Domain Name**: Configured to point to your server
- **SSH Keys**: Upload to `/root/.ssh/authorized_keys` for team access

### Installation

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

Replace `your-domain.com` with your actual domain name.

**Optional: Use a specific branch:**

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com v3
```

This automated script sets up everything: Docker Swarm, firewall, Node.js, users, SSH security, Kong Gateway, and Web UI.

**→ See [ADMIN-SETUP.md](./docs/ADMIN-SETUP.md) for complete instructions**

### Updates

To update an existing installation to the latest version, simply run the setup script again:

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

The script will:

- Detect the existing installation
- Backup your local configuration (`.env`, custom configs)
- Update to the latest version from GitHub
- Restore your configuration
- Rebuild and redeploy services if needed

**Note:** Your applications and data remain untouched during updates.

### System Update Feature (Optional)

After installation, authenticated users can trigger system updates directly from the Web UI:

1. Visit `https://config.your-domain.com`
2. Click "System Update" button in header
3. Confirm and wait for completion

**→ See [SYSTEM-UPDATE.md](./docs/SYSTEM-UPDATE.md) for setup instructions**

This feature requires initialization:

```bash
cd /var/apps/swarm-config
bash scripts/init-host-manager.sh
```

## Quick Start for App Developers

### Web UI (Primary Method)

Visit `https://config.your-domain.com` and create your repository with a few clicks:

1. Enter repository name
2. Set port number
3. Enable Kong Gateway
4. Get your Git URL instantly

### Alternative: API Access

```bash
# Create repository via API (requires SSH key authentication)
curl -X POST https://config.your-domain.com/api/services \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -d '{"name":"myapp","port":3000}'

# In your local project
git remote add production git@your-server:~/myapp.git
git push production main
```

**→ See [APP-DEVELOPER.md](./docs/APP-DEVELOPER.md) for complete deployment guide**

## 📚 Documentation by Role

### 👨‍💼 [Administrator Setup Guide](./docs/ADMIN-SETUP.md)

For **system administrators** setting up and managing the infrastructure.

- Automated server setup with one command
- Web UI deployment for developer self-service
- Kong Gateway configuration
- Portainer and Monitoring deployment (optional)
- Multi-node cluster setup ([MULTI-NODE-SETUP.md](./docs/MULTI-NODE-SETUP.md))
- Troubleshooting and maintenance

### 👨‍💻 [App Developer Guide](./docs/APP-DEVELOPER.md)

For **developers** deploying applications to the platform.

- Create repositories via Web UI (Self-Service)
- Deploy with `git push production main`
- Dockerfile configuration
- Environment variables management
- Kong routes and plugins
- Logs and debugging

### 🔧 [Contributing Guide](./docs/CONTRIBUTING.md)

For **contributors** developing and extending swarm-config.

- Architecture and code structure
- Development environment setup
- TypeScript patterns and best practices
- Testing and deployment workflows

## Repository Structure

```
swarm-config/
├── config/                 # Infrastructure configuration
│   ├── stacks/            # Docker Stack definitions
│   │   ├── kong.yaml      # Kong API Gateway stack
│   │   ├── monitoring.yaml # Prometheus & Grafana stack
│   │   ├── portainer.yaml # Portainer management UI
│   │   └── init.yaml      # Initial bootstrap stack
│   ├── plugins/           # Global Kong plugins (TypeScript)
│   └── consumers/         # Authentication consumers (TypeScript)
│
├── src/                    # TypeScript Source Code
│   ├── generate-kong-config.ts  # Generates Kong config from all sources
│   ├── Service.ts, Plugin.ts    # TypeScript builders (for internal use)
│   └── utils/              # Utility functions
│
├── server/                 # Nuxt Server API
│   ├── api/               # API endpoints (repositories, services, kong)
│   └── utils/             # Kong config generator, Git repos
│
├── pages/                  # Nuxt Pages (Web UI)
│   ├── index.vue          # Dashboard
│   ├── login.vue          # Authentication
│   └── services/          # Service management
│
├── scripts/                # Setup and deployment scripts
│   └── setup.sh           # Automated server setup and updates
│
├── hooks/                  # Git hooks for CI/CD
│   ├── post-receive       # Server-side deployment hook
│   ├── pre-commit         # Local code formatting
│   └── pre-push           # Local tests & build
│
├── kong.yaml              # swarm-config's own Kong config
└── generated/
    └── kong.yaml          # Generated Kong configuration (DO NOT EDIT)
```

## Architecture

This repository combines two complementary systems:

1. **Infrastructure Management** - Kong, Docker Swarm, Monitoring (declarative TypeScript configuration)
2. **CI/CD Platform** - Git-based deployment with automatic Kong configuration

### Deployment Flow

```
Developer → git push → Git Hook → Docker Build → Swarm Deploy → Kong Gateway → HTTPS
```

When you push code:

1. Post-receive hook triggers on server
2. Code is built in temporary directory
3. Tests run automatically
4. Docker image is created
5. Swarm performs zero-downtime rolling update
6. Kong routes traffic to new containers

**→ See [APP-DEVELOPER.md](./docs/APP-DEVELOPER.md) for detailed workflow**

## Kong Configuration

### Automatic Service Setup via Web UI

Visit `https://config.your-domain.com` to create repositories with automatic Kong configuration.

### Configuration Format

App developers manage Kong configuration via YAML files in their repositories:

**In your app repository:**

```
myapp/
├── compose.yaml               # Universal compose file (required)
├── compose.override.yaml      # Local dev overrides (optional)
├── kong.yaml                  # Kong routes and plugins (optional)
├── Dockerfile
└── src/
```

**Example `kong.yaml`:**

```yaml
services:
  - name: myapp_myapp
    url: http://myapp_myapp:3000
    routes:
      - name: myapp_myapp
        hosts:
          - myapp.example.com
        paths:
          - /
        protocols:
          - https
        preserve_host: true
        strip_path: false
        plugins:
          - name: rate-limiting
            config:
              minute: 100
              policy: local
```

### How it Works

1. Developer creates `.swarm/kong.yaml` in their app repository
2. On `git push`, the file is copied to `/var/apps/myapp/kong.yaml`
3. Kong configuration is automatically regenerated
4. Traffic is routed to your app at `https://myapp.example.com`

**→ See [APP-DEVELOPER.md](./docs/APP-DEVELOPER.md#kong-gateway-konfiguration) for all options**

## License

Apache-2.0
