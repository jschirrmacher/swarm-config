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
│   └── utils/             # Kong config generator, Git repos
├── pages/                  # Web UI (Nuxt)
├── src/                    # TypeScript source (Kong config generation)
├── scripts/setup.sh        # Automated server setup
├── hooks/post-receive      # Git deployment hook
├── stacks/                 # Docker Stack definitions (Kong, monitoring)
├── kong.yaml              # swarm-config's own Kong config
└── data/kong.yaml         # Generated Kong config (DO NOT EDIT)
```

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
