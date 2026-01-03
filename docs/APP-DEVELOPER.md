# App Developer Guide

This guide is for developers who want to deploy their application on the Docker Swarm server.

## Overview

The CI/CD system provides:

- **Zero-Configuration Deployment** - Simple `git push` to deploy
- **Automatic SSL/TLS** - Let's Encrypt certificates via Kong
- **Docker Containerization** - Automatic build from Dockerfile
- **Automatic Kong Configuration** - Route to `<appname>.justso.de`
- **Git Hooks** - Local code quality checks

## Quick Start

### Web UI (Standard Method)

Open the Swarm Config Web UI and create your repository with just a few clicks:

**URL:** `https://config.justso.de` (or your configured domain)

1. **Create Repository**
   - Enter name (e.g. `myapp`)
   - Set port (e.g. `3000`)
   - Enable Kong Gateway ✓
   - Click "Create Repository"

2. **Copy Git URL**
   - The URL is displayed automatically
   - Copy to clipboard with "Copy Git URL" button

3. **Deploy in your project**
   ```bash
   git remote add production <copied-git-url>
   git push production main
   ```

**Done!** Your app is running at `https://myapp.justso.de`

### Alternative: Command Line

If the Web UI is not available, contact the administrator or run on the server:

```bash
ssh justso.de
cd /var/apps/swarm-config
npm run init-repo myapp
```

This creates:

- Git repository: `/home/<user>/myapp.git`
- Working directory: `/var/apps/myapp/`
- Kong route: `https://myapp.justso.de`

### 2. Add Git Remote

In your local project:

```bash
git remote add production git@justso.de:~/myapp.git
```

### 3. Create Dockerfile

Your app needs a `Dockerfile` in the root:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### 4. Set Up Git Hooks (Optional but recommended)

In your `package.json`:

```json
{
  "scripts": { "postinstall": "npm run install-hooks" },
  "devDependencies": { "@jschirrmacher/swarm-config": "github:jschirrmacher/swarm-config" }
}
```

This automatically installs:

- **pre-commit**: Code formatting with Prettier
- **pre-push**: Tests and build checks

### 5. Configure Environment Variables

On the server:

```bash
ssh justso.de
nano /var/apps/myapp/.env
```

Example `.env`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@db.justso.de/myapp
API_KEY=secret-key-here
```

**Important**: `.env` is ignored in Git and stays on the server!

### 6. Deploy

```bash
git push production main
```

This happens automatically:

1. Code is pushed to the server
2. Dockerfile is built
3. Docker image is created
4. Docker stack is deployed
5. App is live at `https://myapp.justso.de`

## Project Structure

### Minimum Requirements

```
myapp/
├── Dockerfile           # REQUIRED
├── package.json         # For Node.js apps
├── .dockerignore       # Recommended
└── src/
    └── server.js
```

### Recommended Structure

```
myapp/
├── Dockerfile
├── .dockerignore
├── .swarm/                    # Deployment configuration (in repository!)
│   ├── kong.yaml             # Kong configuration (optional)
│   └── docker-compose.yaml   # Docker Compose (REQUIRED)
├── docker-compose.dev.yaml   # For local development
├── package.json
├── .env.example              # Example configuration
├── README.md
└── src/
    ├── server.js
    └── ...
```

**Important:**

- `.swarm/` directory belongs in the repository
- Files are copied to `/var/apps/myapp/` during deployment
- `.env` and `data/` stay on the server (runtime-specific)

````

## Docker Configuration

### Dockerfile Best Practices

```dockerfile
# 1. Specific base image version
FROM node:20.10-alpine

# 2. Set working directory
WORKDIR /app

# 3. Copy dependencies first (for layer caching)
COPY package*.json ./
RUN npm ci --production

# 4. Copy source code
COPY . .

# 5. Use non-root user
USER node

# 6. Expose port (must match PORT in .env)
EXPOSE 3000

# 7. Define health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node healthcheck.js || exit 1

# 8. Start command
CMD ["node", "src/server.js"]
````

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
*.md
.vscode
.idea
coverage
.nyc_output
dist
build

# Runtime-specific files (not packaged into image)
.env
.env.*
data/
```

### Multi-Stage Builds

For smaller images:

```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Important Note

**⚠️ The `.env` file is runtime-specific and always stays on the server!**

- ❌ Do not commit to repository
- ❌ Is not copied during deployment
- ✅ Stays on the server under `/var/apps/myapp/.env`
- ✅ Use `.env.example` in repository as documentation

### Local Development

`.env.local` or `.env` (local, in .gitignore):

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost/myapp_dev
```

### Production

Server: `/var/apps/myapp/.env` (created on the server):

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-db.justso.de/myapp
```

**Editing on the server:**

```bash
ssh justso.de
nano /var/apps/myapp/.env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-db.justso.de/myapp
```

### Use in Code

```javascript
// server.js
require("dotenv").config()

const port = process.env.PORT || 3000
const dbUrl = process.env.DATABASE_URL

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
```

## Kong Gateway Configuration

### Directory Structure

**In repository:**

```
myapp/
├── .swarm/                    # Deployment configuration
│   ├── kong.yaml             # Kong configuration (optional)
│   └── docker-compose.yaml   # Docker Compose (REQUIRED)
├── Dockerfile
└── src/
```

**On the server (after deployment):**

```
/var/apps/myapp/
├── kong.yaml                  # copied from repo .swarm/kong.yaml
├── docker-compose.yaml        # copied from repo .swarm/docker-compose.yaml
├── .env                       # only on server (runtime-specific)
└── data/                      # only on server (runtime-specific)
```

**Important:**

- In repository, files are located under `.swarm/`
- During deployment they are copied directly to `/var/apps/myapp/` (without `.swarm/`)
- Paths in `docker-compose.yaml` are relative to `/var/apps/myapp/`

### Standard Configuration

After creating a repository via the Web UI, this is automatically created:

```yaml
# Repository: .swarm/kong.yaml (becomes /var/apps/myapp/kong.yaml)
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
    service: myapp_myapp
```

### Custom Configuration

You can customize the `kong.yaml` in your project directory for various use cases:

#### Kong Plugins in your App

You can add Kong plugins directly in your `kong.yaml`:

```yaml
# .swarm/kong.yaml (in your repository)
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
    service: myapp_myapp

plugins:
  # Rate Limiting for your app
  - name: rate-limiting
    config:
      minute: 100
      hour: 10000
      policy: local

  # CORS for frontend access
  - name: cors
    config:
      origins:
        - https://app.justso.de
      methods:
        - GET
        - POST
      credentials: true

  # Request Size Limiting (custom)
  - name: request-size-limiting
    config:
      allowed_payload_size: 5 # 5 MB instead of global 10 MB
      size_unit: megabytes
```

**Available Plugins:**

- `rate-limiting` - Limit requests per time unit
- `cors` - Cross-Origin Resource Sharing
- `basic-auth` - HTTP Basic Authentication
- `jwt` - JSON Web Token Authentication
- `request-size-limiting` - Limit request payload size
- `ip-restriction` - IP whitelisting/blacklisting
- `request-transformer` - Modify HTTP requests
- `response-transformer` - Modify HTTP responses
- `bot-detection` - Detect bot traffic (globally active)
- All Kong Enterprise Plugins: https://docs.konghq.com/hub/

**Global vs. App-specific Plugins:**

- **Global (in swarm-config's .swarm/kong.yaml)**: `acme`, `bot-detection`, `request-size-limiting`
  - These plugins apply automatically to all services
  - Defined in the central Kong configuration
- **App-specific (in your .swarm/kong.yaml)**: All other plugins as needed
  - Rate-limiting, CORS, Authentication, etc.
  - Only for your specific app

You can also override global plugins in your app:

```yaml
plugins:
  # Override global request-size-limiting with different limit
  - name: request-size-limiting
    config:
      allowed_payload_size: 50 # 50 MB for upload service
      size_unit: megabytes
```

#### Simple Web App (Standard)

```yaml
# /var/apps/myapp/kong.yaml
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
    service: myapp_myapp
```

**Use case**: Simple Node.js/Express app, React frontend, Static website

#### API with Multiple Endpoints

```yaml
# /var/apps/api/kong.yaml
services:
  - name: api_api
    url: http://api_api:3000

routes:
  - name: api-v1
    hosts:
      - api.justso.de
    paths:
      - /v1
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: api_api

  - name: api-v2
    hosts:
      - api.justso.de
    paths:
      - /v2
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: api_api
```

**Use case**: REST API with versioning, different endpoints

#### App with Rate Limiting

```yaml
# /var/apps/public-api/kong.yaml
services:
  - name: public-api_api
    url: http://public-api_api:8080

routes:
  - name: public-api_api
    hosts:
      - api.justso.de
    paths:
      - /
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: public-api_api

plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 10000
      policy: local
```

**Use case**: Public API, protection against abuse, fair-use policy

#### App with CORS for Frontend

```yaml
# /var/apps/backend/kong.yaml
services:
  - name: backend_backend
    url: http://backend_backend:4000

routes:
  - name: backend_backend
    hosts:
      - api.justso.de
    paths:
      - /
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: backend_backend

plugins:
  - name: cors
    config:
      origins:
        - https://app.justso.de
        - https://admin.justso.de
      methods:
        - GET
        - POST
        - PUT
        - DELETE
      headers:
        - Content-Type
        - Authorization
      credentials: true
```

**Use case**: Backend for single-page apps, cross-origin requests

#### Protected Admin Area

```yaml
# /var/apps/admin-app/kong.yaml
services:
  - name: admin-app_admin
    url: http://admin-app_admin:3000

routes:
  # Public Routes
  - name: admin-public
    hosts:
      - admin.justso.de
    paths:
      - /
      - /login
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: admin-app_admin

  # Protected Routes with Basic Auth
  - name: admin-protected
    hosts:
      - admin.justso.de
    paths:
      - /dashboard
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: admin-app_admin
    plugins:
      - name: basic-auth

# Optional: Consumers for Basic Auth
# Consumers are manually defined, e.g. for team members
consumers:
  - username: admin
    basicauth_credentials:
      - username: admin
        password: your-secure-password-here
  - username: joachim
    basicauth_credentials:
      - username: joachim
        password: another-secure-password
```

**Use case**: Admin dashboard, protected area, login system

**Consumer Setup**: Consumers must be manually defined in the app configuration. Passwords should be securely generated (e.g. with `openssl rand -base64 32`).

#### Microservice with Multiple Services

```yaml
# /var/apps/shop/kong.yaml
services:
  - name: shop_web
    url: http://shop_web:3000
  - name: shop_api
    url: http://shop_api:4000
  - name: shop_admin
    url: http://shop_admin:5000

routes:
  # Frontend
  - name: shop-frontend
    hosts:
      - shop.justso.de
    paths:
      - /
    protocols:
      - https
    preserve_host: true
    strip_path: false
    service: shop_web

  # API Backend
  - name: shop-api
    hosts:
      - shop.justso.de
    paths:
      - /api
    protocols:
      - https
    preserve_host: true
    strip_path: true
    service: shop_api

  # Admin Panel
  - name: shop-admin
    hosts:
      - shop.justso.de
    paths:
      - /admin
    protocols:
      - https
    preserve_host: true
    strip_path: true
    service: shop_admin
```

**Use case**: E-commerce with frontend, API and admin, multiple containers

#### WebSocket Application

```yaml
# /var/apps/chat/kong.yaml
services:
  - name: chat_chat
    url: http://chat_chat:3000

routes:
  - name: chat-ws
    hosts:
      - chat.justso.de
    paths:
      - /
    protocols:
      - http
      - https
      - ws
      - wss
    preserve_host: true
    strip_path: false
    service: chat_chat
```

**Use case**: Real-time chat, live updates, WebSocket connections

#### API with Request Size Limit

````yaml
# /var/apps/upload/kong.yaml
services:
  - name: upload_upload
    url: http://upload_upload:3000

routes:
  - name: upload_upload
    hosts:
      - upload.justso.de
    paths:
### Edit Configuration

The deployment configuration is located in the `.swarm/` directory of your repository and is copied to `/var/apps/myapp/` during deployment.

#### .swarm/kong.yaml (Optional)

Kong Gateway configuration for routing and plugins.

**Create in repository:**

```yaml
# .swarm/kong.yaml
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
    service: myapp_myapp
````

#### .swarm/docker-compose.yaml (REQUIRED)

Docker Compose configuration for deployment. **Must have `.yaml` file extension.**

**Create in repository:**

```yaml
# .swarm/docker-compose.yaml
services:
  myapp:
    image: ${IMAGE_NAME:-myapp:latest}
    restart: unless-stopped
    env_file:
      - .env # References /var/apps/myapp/.env
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ./data:/app/data # References /var/apps/myapp/data
    networks:
      - kong-net
    labels:
      - "com.docker.stack.namespace=myapp"

networks:
  kong-net:
    external: true
```

**Important:**

- Paths are relative to the deployment directory `/var/apps/myapp/`
- `.env` and `data/` exist only on the server
- File extension must be `.yaml` (not `.yml`)

#### Deployment Workflow

1. **Create `.swarm/` directory in your project:**

```bash
mkdir .swarm
# Create .swarm/docker-compose.yaml (required)
# Create .swarm/kong.yaml (optional)
```

2. **Commit and push:**

```bash
git add .swarm/
git commit -m "Add deployment configuration"
git push production main
```

The post-receive hook automatically copies:

- `.swarm/kong.yaml` → `/var/apps/myapp/kong.yaml`
- `.swarm/docker-compose.yaml` → `/var/apps/myapp/docker-compose.yaml`

**Deployment behavior:**

- ✅ `.swarm/kong.yaml` in repo → copied to `/var/apps/myapp/kong.yaml`
- ✅ `.swarm/docker-compose.yaml` in repo → copied to `/var/apps/myapp/docker-compose.yaml` (REQUIRED)
- ⚠️ No `.swarm/docker-compose.yaml` → deployment fails
- ❌ `.env` is NEVER copied from repository (runtime-specific)
- ❌ `data/` is NEVER copied from repository (runtime-specific)

#### Quick changes on the server

For tests or fixes without deployment:

```bash
ssh justso.de
nano /var/apps/myapp/kong.yaml
# or
nano /var/apps/myapp/docker-compose.yaml
```

After changes

- ✅ Version control of Kong configuration
- ✅ No dependencies - works everywhere
- ✅ IDE validation with YAML plugins
- ✅ Code reviews for configuration changes
- ✅ Easily editable for all developers

#### Option 2: On the server

For quick changes without deployment:

```bash
ssh justso.de
nano /var/apps/myapp/kong.yaml
# or
vim /var/apps/myapp/kong.yaml
```

After saving, reload Kong:

```bash
cd /var/apps/swarm-config
npm run kong:generate
npm run kong:reload
```

Or use the Web UI at `https://config.justso.de`.

**Smart Handling**:

- If `kong.yaml` exists in repository → copied during deployment
- If not → server version remains unchanged
- Kong is automatically reloaded after every deployment

The same applies to `docker-compose.yaml`.

**Recommendation**: Include `kong.yaml` in repository - it's just a simple YAML file without dependencies and makes configuration transparent and versionable.

## Deployment Workflow

### Standard Deployment

```bash
git add .
git commit -m "feature: new feature"
git push production main
```

### With Tests

The Git hooks automatically execute:

- **pre-commit**: `prettier --write` (auto-formatting)
- **pre-push**: `npm test` and `npm run build`

### Skip Manual Deployment

```bash
git push production main --no-verify
```

**Warning**: Not recommended! Use only in emergencies.

## Logs and Debugging

### View Logs

```bash
# Live logs
ssh justso.de 'docker service logs -f myapp_myapp'

# Last 100 lines
ssh justso.de 'docker service logs --tail 100 myapp_myapp'
```

### Service Status

```bash
# Service status
ssh justso.de 'docker service ps myapp_myapp'

# All services in stack
ssh justso.de 'docker stack ps myapp'
```

### Log Into Container

```bash
# Find container ID
ssh justso.de 'docker ps | grep myapp'

# Connect to container
ssh justso.de 'docker exec -it <container-id> sh'
```

## Troubleshooting

### App won't start

1. **Check logs**:

   ```bash
   ssh justso.de 'docker service logs myapp_myapp'
   ```

2. **Check environment variables**:

   ```bash
   ssh justso.de 'cat /var/apps/myapp/.env'
   ```

3. **Test Dockerfile locally**:
   ```bash
   docker build -t myapp-test .
   docker run -p 3000:3000 myapp-test
   ```

### Port Conflict

Ensure the port matches in:

- Dockerfile `EXPOSE 3000`
- `.env` `PORT=3000`
- Kong Config `.addService("myapp", 3000)`

### SSL Certificate Missing

Kong ACME Plugin needs about 2 minutes for Let's Encrypt.
Check:

```bash
ssh justso.de 'docker exec kong_kong kong config dump'
```

### Service not reachable

1. **Check Kong status**:

   ```bash
   ssh justso.de 'docker service ps kong_kong'
   ```

2. **Check DNS**:

   ```bash
   nslookup myapp.justso.de
   ```

3. **Check firewall**:
   ```bash
   ssh justso.de 'sudo ufw status'
   ```

## Best Practices

### 1. Health Checks

Implement a health check endpoint:

```javascript
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() })
})
```

### 2. Graceful Shutdown

```javascript
process.on("SIGTERM", () => {
  server.close(() => {
    console.log("Process terminated")
    process.exit(0)
  })
})
```

### 3. Logging

Use structured logging:

```javascript
const winston = require("winston")

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
})
```

### 4. Error Handling

```javascript
process.on("uncaughtException", error => {
  logger.error("Uncaught Exception:", error)
  process.exit(1)
})

process.on("unhandledRejection", reason => {
  logger.error("Unhandled Rejection:", reason)
})
```

### 5. Security

- Never commit secrets to Git
- Always use HTTPS (Kong does this automatically)
- Regularly update dependencies
- Set security headers (Helmet.js for Express)

## Additional Resources

- [ADMIN-SETUP.md](./ADMIN-SETUP.md) - For administrators
- [CONTRIBUTING.md](./CONTRIBUTING.md) - For swarm-config developers
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
