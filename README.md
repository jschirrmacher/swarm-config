# swarm-config

Complete Docker Swarm infrastructure with Kong API Gateway and Git-based CI/CD deployment platform.

## Features

- 🐳 **Docker Swarm** - Multi-node cluster orchestration
- 🦍 **Kong Gateway** - API Gateway with automatic SSL/TLS via Let's Encrypt
- 🚀 **Git-based CI/CD** - Deploy apps with `git push production main`
- 📊 **Monitoring** - Prometheus & Grafana
- 🎛️ **Portainer** - Web UI for container management
- 🔧 **Automated Setup** - Bootstrap script configures everything

## Quick Start

For complete setup instructions, see the **[Administrator Setup Guide](./docs/ADMIN-SETUP.md)**.

Essential steps:
1. Ubuntu/Debian server with Docker and Node.js (current LTS)
2. Clone this repository to `/var/apps/swarm-config`
3. Run `npm install && npm run bootstrap:fix` (with sudo)
4. Configure Kong and deploy stacks via Portainer

The bootstrap script automatically configures Docker Swarm, networking, firewall, and Portainer.

## 📚 Documentation

- 👨‍💼 **[Administrator Setup Guide](./docs/ADMIN-SETUP.md)** - Complete server setup and infrastructure configuration
- 👨‍💻 **[App Developer Guide](./docs/APP-DEVELOPER.md)** - Deploy your applications with git push
- 🔧 **[Contributing Guide](./docs/CONTRIBUTING.md)** - Develop and extend swarm-config

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
│   ├── bootstrap-server.ts
│   ├── init-repo.ts
│   ├── install-hooks.ts
│   ├── checks/             # Bootstrap validation checks
│   ├── utils/              # Utility functions
│   └── Service.ts, Plugin.ts, etc.
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
2. **CI/CD Platform** - Git-based deployment with automatic Kong configuration (zero-footprint for apps)

## CI/CD Deployment Platform

### Quick Start: Deploy a New Application

```bash
# On the server
cd /var/apps/swarm-config
npm run init-repo myapp
```

This automatically:
1. Creates Git repository at `/opt/git/myapp.git` with deployment hooks
2. Sets up working directory at `/var/apps/myapp/`
3. Creates Kong service configuration for `https://myapp.<your-domain>`
4. Regenerates Kong configuration and reloads it

### In Your Local Project

```bash
# Add the production remote
git remote add production git@your-server:/opt/git/myapp.git

# Add bootstrap script to package.json
{
  "scripts": {
    "postinstall": "nuxt prepare && npm run install-hooks"
  }
}

# Install (downloads git hooks automatically)
npm install

# Deploy
git push production main
```

### What Happens on `git push`

1. ✅ Code checkout to `/tmp/myapp-build-XXXXX` (temporary directory)
2. ✅ Load environment variables from `/var/apps/myapp/.env`
3. ✅ `npm ci` - Install dependencies
4. ✅ `npm test` - Run tests
5. ✅ Docker build with version tag
6. ✅ Deploy to Docker Swarm
7. ✅ Zero-downtime rolling update
8. ✅ Cleanup temporary directory

**Note:** `/var/apps/myapp/` only contains `.env` and persistent data (e.g., `data/` directory), not the application code.

### Architecture

```
Local Project → git push → Server Git Repo → post-receive hook
                                              ↓
                                    /tmp/myapp-build-XXXXX (temp)
                                              ↓
                            npm ci → npm test → docker build
                                              ↓
                                         Docker Swarm
                                              ↓
                                         Kong Gateway
                                              ↓
                                    https://myapp.<your-domain>

/var/apps/myapp/
├── .env              (Configuration)
└── data/             (Persistent data)
```

## Integration: Manual vs. Automatic Kong Configuration

This system uses a modular approach for Kong service configuration:

**Global Configuration (`config.ts`):**
- Infrastructure services (Portainer, Monitoring)
- Global plugins (ACME/SSL, Prometheus, Rate Limiting)
- Consumers and authentication

**Individual Service Files (`services/*.ts`):**
- One TypeScript file per deployed application
- Auto-generated by `npm run init-repo`
- Can be manually customized afterwards

Example auto-generated file `services/myapp.ts`:
```typescript
import { createStack } from "../src/Service.js"

export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.example.com")
```

You can then customize it:
```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.example.com")
  .addRoute("myapp.example.com", {
    paths: ["/api"],
    strip_path: true,
    name: "myapp-api"
  })
  .addPlugin("rate-limiting", {
    minute: 100
  })
```

### How It Works

1. Run `npm run init-repo myapp`
2. Script creates `services/myapp.ts`
3. Runs `npm run kong:generate` which:
   - Loads all `services/*.ts` files
   - Merges with `config.ts`
   - Generates `generated/kong.yaml`
4. Reloads Kong: `docker exec kong kong reload`
5. App is live at `https://myapp.<your-domain>`

### Prerequisites

For the automatic integration to work, ensure that:
- Node.js (current LTS) is installed (specified in `.node-version`)
- Dependencies are installed: `cd /var/apps/swarm-config && npm install`
- The swarm-config repository is checked out at `/var/apps/swarm-config`

## Cleanup

After installing Portainer the same way as Kong you can drop the `init` stack and close port 9000 in the firewall:

```bash
docker stack rm init
sudo ufw delete allow 9000
```
Deploy Your First App

**See [App Developer Guide](./docs/APP-DEVELOPER.md) for complete instructions.**

Quick example:
```bash
# On server: Setup new app
npm run init-repo myapp

# In your project: Deploy
git remote add production git@server:/opt/git/myapp.git
git push production main
```

Your app is now live at `https://myapp.yourdomain.com` with automatic SSL! 🎉

## License

Apache-2.0