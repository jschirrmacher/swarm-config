# swarm-config

Docker Swarm infrastructure with Kong API Gateway and Git-based CI/CD.

## Features

- 🐳 **Docker Swarm** - Single- or multi-node cluster orchestration
- 🦍 **Kong Gateway** - API Gateway with automatic SSL/TLS via Let's Encrypt
- 🚀 **Git-based CI/CD** - Deploy apps with `git push production main`
- 🔧 **Automated Setup** - One-command installation

## Quick Start

### For Administrators

```bash
curl -o- https://raw.githubusercontent.com/jschirrmacher/swarm-config/main/scripts/setup.sh | sudo bash -s your-domain.com
```

Sets up Docker Swarm, firewall, Node.js, users, SSH security, Kong Gateway, and Web UI.

→ [Administrator Guide](./docs/ADMIN-SETUP.md)

### For App Developers

1. Create repository via Web UI at `https://config.your-domain.com`
2. Add remote: `git remote add production <git-url>`
3. Deploy: `git push production main`

→ [App Developer Guide](./docs/APP-DEVELOPER.md)

## Architecture

```
Developer → git push → Git Hook → Docker Build → Swarm Deploy → Kong Gateway → HTTPS
```

### Repository Structure

```
swarm-config/
├── server/                 # Nuxt Server API
│   ├── api/               # REST API endpoints
│   └── utils/             # Utilities (Kong config, Git repos, Domain register)
├── pages/                  # Web UI (Nuxt)
├── components/             # Vue components
├── composables/            # Shared composables (useAuthFetch)
├── middleware/             # Auth middleware
├── types/                  # TypeScript type definitions
├── scripts/                # Setup and maintenance scripts
│   └── setup.sh           # Automated server setup
├── hooks/post-receive      # Git deployment hook
├── stacks/                 # Docker Stack definitions (Kong, monitoring)
├── compose.yaml            # swarm-config deployment config
├── Dockerfile              # Container image definition
├── .env                    # Environment configuration
└── data/kong.yaml         # Generated Kong config (DO NOT EDIT)
```

## Configuration

swarm-config uses Nuxt 3 runtime configuration. Override defaults via environment variables:

### Environment Variables

Set in `/var/apps/swarm-config/.env`:

```bash
# Domain for Kong Gateway and Git URLs
DOMAIN=your-domain.com

# Git repository base path
GIT_REPO_BASE=/home/git/repos

# Application workspace base path
WORKSPACE_BASE=/var/apps

# Let's Encrypt email
TECH_EMAIL=admin@your-domain.com

# User/Group IDs (auto-detected by setup script)
GIT_UID=1004
TEAM_GID=1000
DOCKER_GID=999
```

**Note**: In production, `compose.yaml` automatically maps these to `NUXT_*` variables for the container. For local development, add `NUXT_DOMAIN`, `NUXT_GIT_REPO_BASE`, and `NUXT_WORKSPACE_BASE` to your `.env`. See [Nuxt 3 Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config).

### App Repository Structure

```
myapp/
├── Dockerfile              # Required
├── compose.yaml            # Required
├── kong.yaml               # Optional (Kong routing)
├── compose.override.yaml   # Optional (local dev)
└── src/
```

## License

Apache-2.0
