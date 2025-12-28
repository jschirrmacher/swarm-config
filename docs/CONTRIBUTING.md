# Contributing to swarm-config

Diese Anleitung ist für Entwickler, die am swarm-config Projekt selbst arbeiten möchten.

## Architektur-Überblick

### System-Komponenten

```
swarm-config/
├── config/                 # Deklarative Konfiguration
│   ├── stacks/            # Docker Stack YAML Definitionen
│   ├── services/          # Kong Service Definitionen (auto-generiert)
│   ├── infrastructure/    # Infrastruktur Services (manuell)
│   ├── plugins/           # Globale Kong Plugins
│   └── consumers/         # Authentifizierungs-Consumer
│
├── src/                   # TypeScript Source Code
│   ├── generate-kong-config.ts  # Kong YAML Generator
│   ├── install-hooks.ts         # Git Hooks Installer
│   │
│   ├── Service.ts              # Service Builder
│   ├── Plugin.ts               # Plugin Builder
│   ├── PortainerStack.ts       # Portainer Config
│   └── MonitoringStack.ts      # Monitoring Config
│
├── server/                # Nuxt Server (API Routes)
│   ├── api/                  # REST API Endpoints
│   └── utils/                # Server Utilities
│
├── hooks/                 # Git Hook Templates
│   ├── post-receive      # Server-side Deployment
│   ├── pre-commit        # Local Code Quality
│   └── pre-push          # Local Tests
│
├── utils/
│   └── version.ts        # Semantic Versioning
│
└── generated/
    └── kong.yaml         # Generiertes Kong Config (DO NOT EDIT)
```

### Datenfluss

#### 1. Kong-Konfiguration Generierung

```
config/services/*.ts
config/infrastructure/*.ts   →  generate-kong-config.ts  →  generated/kong.yaml
config/plugins/*.ts                                            ↓
config/consumers/*.ts                                       Kong reload
```

#### 2. App Deployment

```
git push production main
    ↓
post-receive hook
    ↓
Docker build
    ↓
Docker deploy
    ↓
server-setup.sh (bei erstem Deploy)
    ↓
config/services/myapp.ts erstellt
    ↓
npm run kong:generate
```

#### 3. Server Bootstrap

```
scripts/setup.sh
    ↓
Automatische Installation:
- Docker & Swarm
- UFW Firewall
- Node.js 24 LTS
- Team Users
- SSH Security
- Kong Network
- Optional: GlusterFS
```

## Entwicklungsumgebung

### Voraussetzungen

- Node.js (aktuelle LTS-Version oder höher)
- Git
- Docker (für lokale Tests)
- TypeScript Kenntnisse
- Bash Kenntnisse (für Git Hooks)

### Setup

```bash
# Repository klonen
git clone https://github.com/jschirrmacher/swarm-config.git
cd swarm-config

# Dependencies installieren
npm install

# Git Hooks installieren
npm run install-hooks
```

### Verfügbare Scripts

```bash
npm run kong:generate    # Kong YAML generieren
npm run install-hooks    # Git Hooks installieren
npm run dev              # Web UI Entwicklungsserver starten
npm run build            # Web UI für Produktion bauen
```

## Code-Struktur

### TypeScript Konventionen

#### 1. Keine expliziten Typen wenn ableitbar

```typescript
// ❌ Redundant
function getData(): Promise<string> {
  return Promise.resolve("data")
}

// ✅ Type wird abgeleitet
function getData() {
  return Promise.resolve("data")
}
```

#### 2. Interfaces für Contracts

```typescript
// Interfaces für öffentliche Contracts
export interface CheckResult {
  name: string
  passed: boolean
  message: string
  fix?: () => Promise<void>
}

// Type für Unions/Aliases
export type BumpType = "major" | "minor" | "patch"
```

#### 3. Type Imports

```typescript
// Für nur Type-Imports
import type { SomeType } from "./module.ts"

// Für Runtime + Type
import { someFunction, type SomeType } from "./module.ts"
```

### Modulares Design

#### 1. Checks System

Jeder Check ist eine separate Datei in `src/checks/`. Die Checks werden alphabetisch nach Dateinamen sortiert und ausgeführt, daher verwenden wir Nummernpräfixe (01-, 02-, etc.).

```typescript
// src/checks/01-example.ts
import { type CheckResult } from "../bootstrap-helpers.ts"

export default async function checkExample(): Promise<CheckResult> {
  // Check-Logik hier
  return {
    name: "Example Check",
    passed: true,
    message: "Everything is fine",
    fix: async () => {
      // Optional: Auto-Fix Funktion
    },
  }
}
```

Neue Checks werden automatisch von `bootstrap-server.ts` geladen.

**Hinweis:** Die meisten grundlegenden Checks (Docker, UFW, Node.js, Team-Users, SSH-Security) wurden ins `setup.sh` Skript ausgelagert und sind nicht mehr als separate Checks vorhanden.

#### 2. Kong Service Builder

Fluent API für Service-Definitionen:

```typescript
// config/services/example.ts
import { createStack } from "../../src/Service.js"

export default createStack("example")
  .addService("example", 3000)
  .addRoute("example.justso.de")
  .addPlugin("rate-limiting", { minute: 100 })
```

#### 3. Plugin System

Wiederverwendbare Plugin-Definitionen:

```typescript
// src/Plugin.ts
export function createPlugin(name: string, config = {}) {
  return {
    name,
    config,
    get() {
      return { name, config }
    },
  }
}
```

## Kong Configuration

### Service Definition Pattern

```typescript
class Stack {
  private services = []
  private routes = []
  private plugins = []

  addService(name: string, port: number) {
    this.services.push({ name, port })
    return this // Fluent API
  }

  addRoute(host: string, config = {}) {
    this.routes.push({ host, ...config })
    return this
  }

  get() {
    return this.services.map(svc => ({
      name: svc.name,
      url: `http://${svc.name}:${svc.port}`,
      routes: this.routes,
      plugins: this.plugins,
    }))
  }
}
```

### Dynamic Module Loading

```typescript
async function loadModules(dirName: string) {
  const dir = resolve(process.cwd(), "config", dirName)
  const modules = []

  const files = await readdir(dir)
  const tsFiles = files.filter(f => f.endsWith(".ts") && !f.endsWith(".example"))

  for (const file of tsFiles) {
    const modulePath = join(dir, file)
    const module = await import(`file://${modulePath}`)
    if (module.default) {
      modules.push(module.default)
    }
  }

  return modules
}
```

## Git Hooks

### pre-commit Hook

```bash
#!/bin/bash
# Format code with Prettier
npm run format || exit 1
```

### pre-push Hook

```bash
#!/bin/bash
# Run tests before pushing
npm test || exit 1
npm run build || exit 1
```

### post-receive Hook

```bash
#!/bin/bash
# Server-side deployment
BRANCH="main"
APP_NAME=$(basename "$PWD" .git)
WORK_DIR=$(mktemp -d)

# Checkout code
git --work-tree="$WORK_DIR" checkout -f "$BRANCH"

# Build Docker image
docker build -t "$APP_NAME:latest" "$WORK_DIR"

# Deploy stack
docker stack deploy -c "$WORK_DIR/docker-compose.yml" "$APP_NAME"

# Cleanup
rm -rf "$WORK_DIR"
```

## Testing

### Lokale Kong Tests

```bash
# Kong YAML generieren
npm run kong:generate

# Validieren
docker run --rm -v $PWD/generated:/config kong:3.0 \
  kong config parse /config/kong.yaml
```

### Bootstrap Tests

```bash
# Ohne Änderungen
npm run bootstrap

# Mit Auto-Fix (benötigt sudo)
sudo npm run bootstrap:fix
```

### Docker Stack Tests

```bash
# Stack lokal deployen
docker swarm init  # Falls noch nicht initialisiert
docker stack deploy -c config/stacks/kong.yaml test-kong

# Cleanup
docker stack rm test-kong
```

## Deployment Workflow

### 1. Feature entwickeln

```bash
git checkout -b feature/new-check
# Code ändern
npm run kong:generate  # Falls Kong-Config betroffen
git add .
git commit -m "feat: add new check"
```

### 2. Testen

```bash
# Bootstrap tests
npm run bootstrap

# Kong config validieren
npm run kong:generate
```

### 3. Pull Request

```bash
git push origin feature/new-check
# PR auf GitHub erstellen
```

### 4. Merge und Deploy

```bash
git checkout main
git merge feature/new-check
git push origin main
```

### 5. Server aktualisieren

```bash
ssh justso.de
cd /var/apps/swarm-config
git pull
npm install
npm run kong:generate
```

## Neue Features hinzufügen

### Neuer Kong Plugin Helper

1. In `src/Plugin.ts`:

```typescript
export function createMyPlugin(config: MyConfig) {
  return {
    name: "my-plugin",
    config,
    get() {
      return {
        name: "my-plugin",
        config: {
          // Plugin-spezifische Konfiguration
          ...config,
        },
      }
    },
  }
}
```

2. Beispiel erstellen: `config/plugins/my-plugin.ts.example`

3. Dokumentieren in README

### Neuer Git Hook

1. Hook erstellen: `hooks/my-hook`
2. Executable machen: `chmod +x hooks/my-hook`
3. In `install-hooks.ts` hinzufügen:

```typescript
await fetchHook("my-hook")
```

## Debugging

### TypeScript Debugging

In VS Code `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Generate Kong Config",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "args": ["src/generate-kong-config.ts"],
      "cwd": "${workspaceFolder}"
    }
  ]
}
```

### Kong Debugging

```bash
# Kong Logs live
docker service logs -f kong_kong

# Kong Config dump
docker exec $(docker ps -q -f name=kong) kong config dump

# Kong Admin API
curl -i http://localhost:8001/services
```

## Best Practices

### 1. Immutability

```typescript
// ✅ Return new objects
function updateConfig(config) {
  return { ...config, updated: true }
}

// ❌ Mutate parameters
function updateConfig(config) {
  config.updated = true
  return config
}
```

### 2. Error Handling

```typescript
try {
  await dangerousOperation()
} catch (error) {
  console.error("Failed:", error instanceof Error ? error.message : String(error))
  process.exit(1)
}
```

### 3. Async/Await

```typescript
// ✅ Parallel execution wo möglich
const [services, plugins] = await Promise.all([loadModules("services"), loadModules("plugins")])

// ❌ Sequential ohne Not
const services = await loadModules("services")
const plugins = await loadModules("plugins")
```

### 4. Type Safety

```typescript
// ✅ Type-safe configuration
interface ServiceConfig {
  name: string
  port: number
  routes: RouteConfig[]
}

// ❌ Any types
function createService(config: any) {}
```

## Dokumentation

### Code Comments

```typescript
/**
 * Load TypeScript modules from a directory
 *
 * @param dirName - Directory name relative to config/
 * @returns Array of loaded module exports
 */
async function loadModules(dirName: string) {
  // Implementation
}
```

### README Updates

Bei neuen Features immer README.md aktualisieren:

- Was macht das Feature?
- Wie wird es verwendet?
- Welche Konfiguration ist nötig?
- Beispiele hinzufügen

## Release Management

### Versioning

Semantic Versioning (SemVer) verwenden:

```bash
# Patch: Bugfixes
npm run version:bump patch

# Minor: Neue Features (backwards compatible)
npm run version:bump minor

# Major: Breaking Changes
npm run version:bump major
```

### Git Tags

```bash
# Tag erstellen
npm run version:tag

# Tag pushen
git push origin v2.0.0
```

## Support

Bei Fragen oder Problemen:

- GitHub Issues: https://github.com/jschirrmacher/swarm-config/issues
- Email: tech@justso.de

## License

Apache-2.0 - siehe LICENSE Datei
