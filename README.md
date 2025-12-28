# swarm-config

Complete Docker Swarm infrastructure with Kong API Gateway and Git-based CI/CD deployment platform.

## Features

- 🐳 **Docker Swarm** - Single- or multi-node cluster orchestration
- 🦍 **Kong Gateway** - API Gateway with automatic SSL/TLS via Let's Encrypt
- 🚀 **Git-based CI/CD** - Deploy apps with `git push production main`
- 📊 **Monitoring** - Prometheus & Grafana
- 🎛️ **Portainer** - Web UI for container management
- 🔧 **Automated Setup** - One-command installation script

## 📚 Documentation by Role

### 👨‍💼 [Administrator Setup Guide](./docs/ADMIN-SETUP.md)
For **system administrators** setting up and managing the infrastructure.
- Automated server setup with one command
- Kong Gateway configuration
- Portainer and Monitoring deployment
- Multi-node cluster setup ([MULTI-NODE-SETUP.md](./docs/MULTI-NODE-SETUP.md))
- Troubleshooting and maintenance

### 👨‍💻 [App Developer Guide](./docs/APP-DEVELOPER.md)
For **developers** deploying applications to the platform.
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

## Quick Start for Administrators

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/next/scripts/initial-setup.sh | sudo bash
```

This automated script sets up everything: Docker Swarm, firewall, Node.js, users, SSH security, and Kong Gateway.

**→ See [ADMIN-SETUP.md](./docs/ADMIN-SETUP.md) for complete instructions**

## Quick Start for App Developers

```bash
# On server (done by admin)
cd /var/apps/swarm-config
npm run init-repo myapp

# In your local project
git remote add production git@your-server:/opt/git/myapp.git
git push production main
```

Your app is live at `https://myapp.your-domain.com` with automatic SSL! 🎉

**→ See [APP-DEVELOPER.md](./docs/APP-DEVELOPER.md) for complete guide**

## Repository Structure

```
swarm-config/
├── config/                 # Configuration files
│   ├── stacks/            # Docker Stack definitions
│   │   ├── kong.yaml      # Kong API Gateway stack
│   │   ├── monitoring.yaml # Prometheus & Grafana stack
│   │   ├── portainer.yaml # Portainer management UI
│   │   └── init.yaml      # Initial bootstrap stack
│   ├── services/          # Auto-deployed application services
│   ├── infrastructure/    # Infrastructure services (Portainer, Monitoring)
│   ├── plugins/           # Global Kong plugins
│   └── consumers/         # Authentication consumers
│
├── src/                    # TypeScript Source Code
│   ├── generate-kong-config.ts
│   ├── init-repo.ts
│   ├── install-hooks.ts
│   ├── utils/              # Utility functions
│   └── Service.ts, Plugin.ts, etc.
│
├── scripts/                # Setup and deployment scripts
│   └── initial-setup.sh   # Automated server setup
│
├── hooks/                  # Git hooks for CI/CD
│   ├── post-receive       # Server-side deployment hook
│   ├── pre-commit         # Local code formatting
│   └── pre-push           # Local tests & build
│
├── utils/
│   └── version.ts         # Version management
│
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

### Automatic Service Setup

```bash
npm run init-repo myapp
```

Creates `config/services/myapp.ts`:
```typescript
import { createStack } from "../../src/Service.js"

export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.example.com")
```

### Customization

Add routes, plugins, and more:

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.example.com")
  .addRoute("myapp.example.com", {
    paths: ["/api"],
    strip_path: true
  })
  .addPlugin("rate-limiting", { minute: 100 })
```

Then regenerate Kong config:
```bash
npm run kong:generate
```

**→ See [APP-DEVELOPER.md](./docs/APP-DEVELOPER.md#kong-gateway-konfiguration) for all options**

## License

Apache-2.0