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

### Web UI (Standard-Methode)

Öffne die Swarm Config Web UI und erstelle dein Repository mit wenigen Klicks:

**URL:** `https://config.justso.de` (oder deine konfigurierte Domain)

1. **Repository erstellen**
   - Name eingeben (z.B. `myapp`)
   - Port festlegen (z.B. `3000`)
   - Kong Gateway aktivieren ✓
   - "Create Repository" klicken

2. **Git URL kopieren**
   - Die URL wird automatisch angezeigt
   - Mit Button "Copy Git URL" in Zwischenablage kopieren

3. **In deinem Projekt deployen**
   ```bash
   git remote add production <kopierte-git-url>
   git push production main
   ```

**Fertig!** Deine App läuft unter `https://myapp.justso.de`

### Alternative: Command Line

Falls die Web UI nicht verfügbar ist, kontaktiere den Administrator oder führe auf dem Server aus:

```bash
ssh justso.de
cd /var/apps/swarm-config
npm run init-repo myapp
```

Dies erstellt:

- Git Repository: `/home/<user>/myapp.git`
- Arbeitsverzeichnis: `/var/apps/myapp/`
- Kong Route: `https://myapp.justso.de`

### 2. Git Remote hinzufügen

In deinem lokalen Projekt:

```bash
git remote add production git@justso.de:~/myapp.git
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
  "scripts": { "postinstall": "npm run install-hooks" },
  "devDependencies": { "@jschirrmacher/swarm-config": "github:jschirrmacher/swarm-config" }
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
├── .swarm/                    # Deployment-Konfiguration (im Repository!)
│   ├── kong.yaml             # Kong-Konfiguration (optional)
│   └── docker-compose.yaml   # Docker Compose (ERFORDERLICH)
├── docker-compose.dev.yaml   # Für lokale Entwicklung
├── package.json
├── .env.example              # Beispiel-Konfiguration
├── README.md
└── src/
    ├── server.js
    └── ...
```

**Wichtig:**

- `.swarm/` Verzeichnis gehört ins Repository
- Dateien werden beim Deployment nach `/var/apps/myapp/` kopiert
- `.env` und `data/` bleiben auf dem Server (laufzeitspezifisch)

````

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

# Laufzeitspezifische Dateien (werden nicht ins Image gepackt)
.env
.env.*
data/
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

Wichtiger Hinweis

**⚠️ Die `.env` Datei ist laufzeitspezifisch und bleibt immer auf dem Server!**

- ❌ Nicht ins Repository committen
- ❌ Wird nicht beim Deployment kopiert
- ✅ Bleibt auf dem Server unter `/var/apps/myapp/.env`
- ✅ Verwende `.env.example` im Repository als Dokumentation

### Lokale Entwicklung

`.env.local` oder `.env` (lokal, in .gitignore):

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://localhost/myapp_dev
```

### Production

Server: `/var/apps/myapp/.env` (wird auf dem Server angelegt):

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-db.justso.de/myapp
```

**Bearbeitung auf dem Server:**

```bash
ssh justso.de
nano /var/apps/myapp/.env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://prod-db.justso.de/myapp
```

### In Code verwenden

```javascript
// server.js
require("dotenv").config()

const port = process.env.PORT || 3000
const dbUrl = process.env.DATABASE_URL

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
```

## Kong Gateway Konfiguration

### Verzeichnisstruktur

**Im Repository:**

```
myapp/
├── .swarm/                    # Deployment-Konfiguration
│   ├── kong.yaml             # Kong-Konfiguration (optional)
│   └── docker-compose.yaml   # Docker Compose (ERFORDERLICH)
├── Dockerfile
└── src/
```

**Auf dem Server (nach Deployment):**

```
/var/apps/myapp/
├── kong.yaml                  # kopiert aus Repo .swarm/kong.yaml
├── docker-compose.yaml        # kopiert aus Repo .swarm/docker-compose.yaml
├── .env                       # nur auf Server (laufzeitspezifisch)
└── data/                      # nur auf Server (laufzeitspezifisch)
```

**Wichtig:**

- Im Repository liegen die Dateien unter `.swarm/`
- Beim Deployment werden sie direkt nach `/var/apps/myapp/` kopiert (ohne `.swarm/`)
- Pfade in `docker-compose.yaml` sind relativ zu `/var/apps/myapp/`

### Standard-Konfiguration

Nach dem Anlegen eines Repositories über die Web-UI wird automatisch erstellt:

```yaml
# Repository: .swarm/kong.yaml (wird zu /var/apps/myapp/kong.yaml)
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
    https_redirect_status_code: 302
    service: myapp_myapp
```

### Custom Konfiguration

Du kannst die `kong.yaml` in deinem Projektverzeichnis anpassen für verschiedene Anwendungsfälle:

#### Kong Plugins in deiner App

Du kannst Kong-Plugins direkt in deiner `kong.yaml` hinzufügen:

```yaml
# .swarm/kong.yaml (in deinem Repository)
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
    https_redirect_status_code: 302
    service: myapp_myapp

plugins:
  # Rate Limiting für deine App
  - name: rate-limiting
    config:
      minute: 100
      hour: 10000
      policy: local

  # CORS für Frontend-Zugriff
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
      allowed_payload_size: 5 # 5 MB statt global 10 MB
      size_unit: megabytes
```

**Verfügbare Plugins:**

- `rate-limiting` - Anfragen pro Zeiteinheit limitieren
- `cors` - Cross-Origin Resource Sharing
- `basic-auth` - HTTP Basic Authentication
- `jwt` - JSON Web Token Authentication
- `request-size-limiting` - Request Payload Size limitieren
- `ip-restriction` - IP-Whitelisting/-Blacklisting
- `request-transformer` - HTTP Request modifizieren
- `response-transformer` - HTTP Response modifizieren
- `bot-detection` - Bot Traffic erkennen (global aktiv)
- Alle Kong Enterprise Plugins: https://docs.konghq.com/hub/

**Globale vs. App-spezifische Plugins:**

- **Global (in swarm-config's .swarm/kong.yaml)**: `acme`, `bot-detection`, `request-size-limiting`
  - Diese Plugins gelten automatisch für alle Services
  - Definiert in der zentralen Kong-Konfiguration
- **App-spezifisch (in deiner .swarm/kong.yaml)**: Alle anderen Plugins nach Bedarf
  - Rate-limiting, CORS, Authentication, etc.
  - Nur für deine spezifische App

Du kannst auch globale Plugins in deiner App überschreiben:

```yaml
plugins:
  # Überschreibe globales request-size-limiting mit anderem Limit
  - name: request-size-limiting
    config:
      allowed_payload_size: 50 # 50 MB für Upload-Service
      size_unit: megabytes
```

#### Einfache Web-App (Standard)

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
    https_redirect_status_code: 302
    service: myapp_myapp
```

**Anwendungsfall**: Simple Node.js/Express App, React Frontend, Static Website

#### API mit mehreren Endpunkten

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
    https_redirect_status_code: 302
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
    https_redirect_status_code: 302
    service: api_api
```

**Anwendungsfall**: REST API mit Versionierung, unterschiedliche Endpunkte

#### App mit Rate Limiting

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
    https_redirect_status_code: 302
    service: public-api_api

plugins:
  - name: rate-limiting
    config:
      minute: 100
      hour: 10000
      policy: local
```

**Anwendungsfall**: Öffentliche API, Schutz vor Missbrauch, Fair-Use-Policy

#### App mit CORS für Frontend

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
    https_redirect_status_code: 302
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

**Anwendungsfall**: Backend für Single-Page-Apps, Cross-Origin Requests

#### Protected Admin-Bereich

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
    https_redirect_status_code: 302
    service: admin-app_admin

  # Protected Routes mit Basic Auth
  - name: admin-protected
    hosts:
      - admin.justso.de
    paths:
      - /dashboard
    protocols:
      - https
    preserve_host: true
    strip_path: false
    https_redirect_status_code: 302
    service: admin-app_admin
    plugins:
      - name: basic-auth

# Optional: Consumers für Basic Auth
# Consumers werden manuell definiert, z.B. für Team-Mitglieder
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

**Anwendungsfall**: Admin-Dashboard, geschützter Bereich, Login-System

**Consumer Setup**: Consumers müssen manuell in der App-Konfiguration definiert werden. Die Passwörter sollten sicher generiert werden (z.B. mit `openssl rand -base64 32`).

#### Microservice mit mehreren Services

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
    https_redirect_status_code: 302
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
    https_redirect_status_code: 302
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
    https_redirect_status_code: 302
    service: shop_admin
```

**Anwendungsfall**: E-Commerce mit Frontend, API und Admin, mehrere Container

#### WebSocket-Anwendung

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
    https_redirect_status_code: 302
    service: chat_chat
```

**Anwendungsfall**: Real-time Chat, Live-Updates, WebSocket-Verbindungen

#### API mit Request Size Limit

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
### Konfiguration bearbeiten

Die Deployment-Konfiguration liegt im `.swarm/` Verzeichnis deines Repositories und wird beim Deployment nach `/var/apps/myapp/` kopiert.

#### .swarm/kong.yaml (Optional)

Kong-Gateway-Konfiguration für Routing und Plugins.

**Erstellen im Repository:**

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
    https_redirect_status_code: 302
    service: myapp_myapp
````

#### .swarm/docker-compose.yaml (ERFORDERLICH)

Docker-Compose-Konfiguration für das Deployment. **Muss die Dateiendung `.yaml` haben.**

**Erstellen im Repository:**

```yaml
# .swarm/docker-compose.yaml
services:
  myapp:
    image: ${IMAGE_NAME:-myapp:latest}
    restart: unless-stopped
    env_file:
      - .env # Referenziert /var/apps/myapp/.env
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ./data:/app/data # Referenziert /var/apps/myapp/data
    networks:
      - kong-net
    labels:
      - "com.docker.stack.namespace=myapp"

networks:
  kong-net:
    external: true
```

**Wichtig:**

- Pfade sind relativ zum Deployment-Verzeichnis `/var/apps/myapp/`
- `.env` und `data/` existieren nur auf dem Server
- Dateiendung muss `.yaml` sein (nicht `.yml`)

#### Deployment-Workflow

1. **Erstelle `.swarm/` Verzeichnis in deinem Projekt:**

```bash
mkdir .swarm
# Erstelle .swarm/docker-compose.yaml (erforderlich)
# Erstelle .swarm/kong.yaml (optional)
```

2. **Committe und pushe:**

```bash
git add .swarm/
git commit -m "Add deployment configuration"
git push production main
```

Der post-receive Hook kopiert automatisch:

- `.swarm/kong.yaml` → `/var/apps/myapp/kong.yaml`
- `.swarm/docker-compose.yaml` → `/var/apps/myapp/docker-compose.yaml`

**Deployment-Verhalten:**

- ✅ `.swarm/kong.yaml` im Repo → wird nach `/var/apps/myapp/kong.yaml` kopiert
- ✅ `.swarm/docker-compose.yaml` im Repo → wird nach `/var/apps/myapp/docker-compose.yaml` kopiert (ERFORDERLICH)
- ⚠️ Keine `.swarm/docker-compose.yaml` → Deployment schlägt fehl
- ❌ `.env` wird NIE aus dem Repository kopiert (laufzeitspezifisch)
- ❌ `data/` wird NIE aus dem Repository kopiert (laufzeitspezifisch)

#### Schnelle Änderungen auf dem Server

Für Tests oder Fixes ohne Deployment:

```bash
ssh justso.de
nano /var/apps/myapp/kong.yaml
# oder
nano /var/apps/myapp/docker-compose.yaml
```

Nach Änderunge

- ✅ Versionskontrolle der Kong-Konfiguration
- ✅ Keine Dependencies - funktioniert überall
- ✅ IDE-Validierung mit YAML-Plugins
- ✅ Code-Reviews für Konfigurationsänderungen
- ✅ Einfach editierbar für alle Entwickler

#### Option 2: Auf dem Server

Für schnelle Änderungen ohne Deployment:

```bash
ssh justso.de
nano /var/apps/myapp/kong.yaml
# oder
vim /var/apps/myapp/kong.yaml
```

Nach dem Speichern Kong neu laden:

```bash
cd /var/apps/swarm-config
npm run kong:generate
npm run kong:reload
```

Oder nutze die Web-UI unter `https://config.justso.de`.

**Smart Handling**:

- Wenn `kong.yaml` im Repository existiert → wird beim Deployment kopiert
- Wenn nicht → bleibt die Server-Version unverändert
- Kong wird nach jedem Deployment automatisch neu geladen

Das Gleiche gilt für `docker-compose.yaml`.

**Empfehlung**: Nimm `kong.yaml` ins Repository auf - es ist nur eine einfache YAML-Datei ohne Dependencies und macht die Konfiguration transparent und versionierbar.

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

Strukturiertes Logging nutzen:

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

- Nie Secrets in Git committen
- Immer HTTPS verwenden (Kong macht das automatisch)
- Regelmäßig Dependencies aktualisieren
- Security Headers setzen (Helmet.js für Express)

## Weitere Ressourcen

- [ADMIN-SETUP.md](./ADMIN-SETUP.md) - Für Administratoren
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Für swarm-config Entwickler
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
