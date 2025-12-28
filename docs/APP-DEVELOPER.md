# App Developer Guide

Diese Anleitung ist für Entwickler, die ihre Anwendung auf dem Docker Swarm Server deployen möchten.

## Überblick

Das CI/CD-System bietet:
- **Zero-Configuration Deployment** - Einfaches `git push` zum Deployen
- **Automatisches SSL/TLS** - Let's Encrypt Zertifikate via Kong
- **Docker Containerisierung** - Automatischer Build aus Dockerfile
- **Automatische Kong-Konfiguration** - Route zu `<appname>.justso.de`
- **Git Hooks** - Lokale Code-Quality Checks

## Schnellstart

### 1. Server-Repository einrichten

Kontaktiere den Administrator oder führe auf dem Server aus:

```bash
ssh justso.de
cd /var/apps/swarm-config
npm run init-repo myapp
```

Dies erstellt:
- Git Repository: `/opt/git/myapp.git`
- Arbeitsverzeichnis: `/var/apps/myapp/`
- Kong Route: `https://myapp.justso.de`

### 2. Git Remote hinzufügen

In deinem lokalen Projekt:

```bash
git remote add production git@justso.de:/opt/git/myapp.git
```

### 3. Dockerfile erstellen

Deine App benötigt ein `Dockerfile` im Root:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

### 4. Git Hooks einrichten (Optional aber empfohlen)

In deiner `package.json`:

```json
{
  "scripts": {
    "postinstall": "npm run install-hooks"
  },
  "devDependencies": {
    "@jschirrmacher/swarm-config": "github:jschirrmacher/swarm-config"
  }
}
```

Dies installiert automatisch:
- **pre-commit**: Code-Formatierung mit Prettier
- **pre-push**: Tests und Build-Checks

### 5. Environment Variables konfigurieren

Auf dem Server:

```bash
ssh justso.de
nano /var/apps/myapp/.env
```

Beispiel `.env`:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@db.justso.de/myapp
API_KEY=secret-key-hier
```

**Wichtig**: `.env` ist in Git ignoriert und bleibt auf dem Server!

### 6. Deployen

```bash
git push production main
```

Das passiert automatisch:
1. Code wird auf den Server gepusht
2. Dockerfile wird gebaut
3. Docker Image wird erstellt
4. Docker Stack wird deployed
5. App ist live unter `https://myapp.justso.de`

## Projektstruktur

### Minimale Anforderungen

```
myapp/
├── Dockerfile           # ERFORDERLICH
├── package.json         # Für Node.js Apps
├── .dockerignore       # Empfohlen
└── src/
    └── server.js
```

### Empfohlene Struktur

```
myapp/
├── Dockerfile
├── .dockerignore
├── docker-compose.yml   # Für lokale Entwicklung
├── package.json
├── .env.example        # Beispiel-Konfiguration
├── README.md
└── src/
    ├── server.js
    └── ...
```

## Docker-Konfiguration

### Dockerfile Best Practices

```dockerfile
# 1. Spezifische Base Image Version
FROM node:20.10-alpine

# 2. Arbeitsverzeichnis setzen
WORKDIR /app

# 3. Dependencies erst kopieren (für Layer Caching)
COPY package*.json ./
RUN npm ci --production

# 4. Source Code kopieren
COPY . .

# 5. Non-root User verwenden
USER node

# 6. Port exponieren (muss mit .env PORT übereinstimmen)
EXPOSE 3000

# 7. Health Check definieren
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node healthcheck.js || exit 1

# 8. Start Command
CMD ["node", "src/server.js"]
```

### .dockerignore

```
node_modules
npm-debug.log
.git
.gitignore
.env
.env.*
*.md
.vscode
.idea
coverage
.nyc_output
dist
build
```

### Multi-Stage Builds

Für kleinere Images:

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

## Environment Management

### Lokale Entwicklung

`.env.local`:
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost/myapp_dev
```

### Production

Server: `/var/apps/myapp/.env`:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-db.justso.de/myapp
```

### In Code verwenden

```javascript
// server.js
require('dotenv').config()

const port = process.env.PORT || 3000
const dbUrl = process.env.DATABASE_URL

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
```

## Kong Gateway Konfiguration

### Standard-Konfiguration

Nach `npm run init-repo myapp` wird automatisch erstellt:

```typescript
// /var/apps/swarm-config/config/services/myapp.ts
import { createStack } from "../../src/Service.js"

export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
```

### Custom Konfiguration

Du kannst die Datei anpassen für:

#### Mehrere Routes

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
  .addRoute("myapp.justso.de", {
    paths: ["/api"],
    strip_path: true,
    name: "myapp-api"
  })
```

#### Rate Limiting

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
  .addPlugin("rate-limiting", {
    minute: 100,
    hour: 1000
  })
```

#### CORS

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
  .addPlugin("cors", {
    origins: ["https://frontend.example.com"],
    methods: ["GET", "POST"],
    headers: ["Content-Type", "Authorization"]
  })
```

#### Basic Auth

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de", {
    paths: ["/admin"]
  })
  .addPlugin("basic-auth")
```

Nach Änderungen Kong neu generieren:

```bash
ssh justso.de
cd /var/apps/swarm-config
npm run kong:generate
```

## Deployment-Workflow

### Standard Deployment

```bash
git add .
git commit -m "feature: neue Funktion"
git push production main
```

### Mit Tests

Die Git Hooks führen automatisch aus:
- **pre-commit**: `prettier --write` (Auto-Formatierung)
- **pre-push**: `npm test` und `npm run build`

### Manuelles Deployment überspringen

```bash
git push production main --no-verify
```

**Achtung**: Nicht empfohlen! Nur in Notfällen verwenden.

## Logs und Debugging

### Logs anschauen

```bash
# Live-Logs
ssh justso.de 'docker service logs -f myapp_myapp'

# Letzte 100 Zeilen
ssh justso.de 'docker service logs --tail 100 myapp_myapp'
```

### Service Status

```bash
# Service-Status
ssh justso.de 'docker service ps myapp_myapp'

# Alle Services im Stack
ssh justso.de 'docker stack ps myapp'
```

### In Container einloggen

```bash
# Container ID finden
ssh justso.de 'docker ps | grep myapp'

# In Container verbinden
ssh justso.de 'docker exec -it <container-id> sh'
```

## Troubleshooting

### App startet nicht

1. **Logs prüfen**:
   ```bash
   ssh justso.de 'docker service logs myapp_myapp'
   ```

2. **Environment Variables prüfen**:
   ```bash
   ssh justso.de 'cat /var/apps/myapp/.env'
   ```

3. **Dockerfile lokal testen**:
   ```bash
   docker build -t myapp-test .
   docker run -p 3000:3000 myapp-test
   ```

### Port-Konflikt

Stelle sicher, dass Port in:
- Dockerfile `EXPOSE 3000`
- `.env` `PORT=3000`
- Kong Config `.addService("myapp", 3000)`

übereinstimmen.

### SSL-Zertifikat fehlt

Kong ACME Plugin braucht ca. 2 Minuten für Let's Encrypt.
Prüfen:

```bash
ssh justso.de 'docker exec kong_kong kong config dump'
```

### Service nicht erreichbar

1. **Kong Status prüfen**:
   ```bash
   ssh justso.de 'docker service ps kong_kong'
   ```

2. **DNS prüfen**:
   ```bash
   nslookup myapp.justso.de
   ```

3. **Firewall prüfen**:
   ```bash
   ssh justso.de 'sudo ufw status'
   ```

## Best Practices

### 1. Health Checks

Implementiere einen Health-Check Endpoint:

```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() })
})
```

### 2. Graceful Shutdown

```javascript
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})
```

### 3. Logging

Strukturiertes Logging nutzen:

```javascript
const winston = require('winston')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
})
```

### 4. Error Handling

```javascript
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason)
})
```

### 5. Security

- Nie Secrets in Git committen
- Immer HTTPS verwenden (Kong macht das automatisch)
- Regelmäßig Dependencies aktualisieren
- Security Headers setzen (Helmet.js für Express)

## Weitere Ressourcen

- [ADMIN-SETUP.md](./ADMIN-SETUP.md) - Für Administratoren
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Für swarm-config Entwickler
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
