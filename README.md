# swarm-config

Docker Swarm infrastructure with Kong API Gateway and Git-based CI/CD.

## Features

- 🐳 **Docker Swarm** - Single- or multi-node cluster orchestration
- 🦍 **Kong Gateway** - API Gateway with automatic SSL/TLS via Let's Encrypt
- 🚀 **Git-based CI/CD** - Deploy apps with `git push production main`
- 🎬 **Post-Deploy Hooks** - Automatic post-deployment tasks (migrations, cache, etc.)
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
Developer → git push → Git Hook → [Docker Build] → Swarm Deploy → Kong Gateway → HTTPS
                                     (optional)
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
├── docs/                   # Documentation
│   ├── ADMIN-SETUP.md     # Administrator guide
│   └── APP-DEVELOPER.md   # App developer guide
├── scripts/                # Setup and maintenance scripts
│   ├── setup.sh           # Automated server setup
│   └── ...                # Utility scripts
├── hooks/                  # Git deployment hooks
│   ├── post-receive       # Main deployment hook
│   └── post-receive-swarm-config  # swarm-config update hook
├── stacks/                 # Docker Stack definitions (Kong, monitoring)
├── compose.yaml            # swarm-config deployment config
├── Dockerfile              # Container image definition
├── .env                    # Environment configuration
└── data/kong.yaml         # Generated Kong config (DO NOT EDIT)
```

## Configuration

swarm-config uses Nuxt 3 runtime configuration. Override defaults via environment variables:

### Environment Variables

**Production** - Set in `/var/apps/swarm-config/.env`:

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

The `compose.yaml` automatically maps these to `NUXT_*` variables for the container.

**Local Development** - Add to your `.env`:

```bash
NUXT_DOMAIN=localhost
NUXT_GIT_REPO_BASE=/path/to/your/repos
NUXT_WORKSPACE_BASE=/path/to/your/workspace
NUXT_TECH_EMAIL=your@email.com
```

See [Nuxt 3 Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config) for details.

### App Repository Structure

```
myapp/
├── compose.yaml            # Required - Docker Stack definition
├── Dockerfile              # Optional - Custom build (or use pre-built images)
├── project.json            # Optional - Kong routing and metadata
├── post-deploy.sh          # Optional - Post-deployment tasks
├── .env                    # Auto-created - Environment variables
└── src/
```

**Workspace Structure:**

- With owner (from `project.json`): `/var/apps/<owner>/<app>/`
- Without owner: `/var/apps/<app>/`

## License

Apache-2.0
