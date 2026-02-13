# App Developer Guide

Deploy your application on the Docker Swarm server with `git push`.

## Quick Start

1. **Create repository** via Web UI at `https://config.justso.de`
   - Enter name, set port, enable Kong Gateway
   - Copy the displayed Git URL

2. **Add remote and deploy:**
   ```bash
   git remote add production <copied-git-url>
   git push production main
   ```

Your app is live at `https://myapp.justso.de`.

## Required Files

```
myapp/
├── Dockerfile           # REQUIRED
├── compose.yaml         # REQUIRED
├── compose.override.yaml # Local dev overrides (optional)
├── kong.yaml            # Kong routing (optional)
├── .dockerignore        # Recommended
└── src/
```

### compose.yaml

Works for both local development and production via environment variables:

```yaml
services:
  myapp:
    image: myapp:${VERSION:-latest}
    volumes:
      - ${DATA_PATH:-./data}:/app/data
    env_file:
      - ${ENV_FILE:-./.env}
    networks:
      - ${NETWORK_NAME:-default}
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

networks:
  default:
  kong-net:
    external: true
```

For local development, add `compose.override.yaml`:

```yaml
services:
  myapp:
    ports:
      - "3000:3000"
```

### kong.yaml

Optional. Created automatically when using the Web UI. Example:

```yaml
services:
  - name: myapp_myapp
    url: http://myapp_myapp:3000
    routes:
      - name: myapp_myapp
        hosts:
          - myapp.justso.de
        paths:
          - /
        protocols:
          - https
        preserve_host: true
        strip_path: false
```

You can add Kong plugins (rate-limiting, cors, basic-auth, jwt, etc.) in the `plugins` section. See [Kong Plugin Hub](https://docs.konghq.com/hub/) for all options.

Global plugins (`acme`, `bot-detection`, `request-size-limiting`) are defined centrally and apply to all services. You can override them per app.

## Environment Variables

On the server under `/var/apps/myapp/.env` (never committed to Git):

```bash
ssh justso.de
nano /var/apps/myapp/.env
```

Use `.env.example` in your repository as documentation.

## Deployment

### What happens on `git push`

1. Code is checked out on the server
2. Dependencies installed, tests run
3. Docker image built
4. Stack deployed to Docker Swarm
5. Kong configuration regenerated

### Deployment behavior

- ✅ `compose.yaml` → copied to server (REQUIRED)
- ✅ `kong.yaml` → copied to server (optional)
- ❌ `.env`, `data/`, `compose.override.yaml` are NOT copied

### Git Hooks (optional)

Install via `package.json`:

```json
{
  "scripts": { "postinstall": "npm run install-hooks" },
  "devDependencies": { "@jschirrmacher/swarm-config": "github:jschirrmacher/swarm-config" }
}
```

- **pre-commit**: auto-formatting with Prettier
- **pre-push**: tests and build checks

## Logs and Debugging

```bash
# Live logs
ssh justso.de 'docker service logs -f myapp_myapp'

# Service status
ssh justso.de 'docker service ps myapp_myapp'

# Shell into container
ssh justso.de 'docker exec -it $(docker ps -q -f name=myapp_myapp) sh'
```

## Troubleshooting

| Problem | Check |
|---------|-------|
| App won't start | `docker service logs myapp_myapp` |
| Port conflict | Dockerfile EXPOSE, .env PORT, and Kong config must match |
| SSL missing | Wait ~2 min for Let's Encrypt, check `docker service ps kong_kong` |
| Not reachable | DNS (`nslookup myapp.justso.de`), firewall (`sudo ufw status`) |

## Quick Server Changes

Edit Kong config without redeployment:

```bash
ssh justso.de
nano /var/apps/myapp/kong.yaml
cd /var/apps/swarm-config && npm run kong:generate && npm run kong:reload
```
