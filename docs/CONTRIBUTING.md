# Contributing to swarm-config

This guide is for developers who want to work on the swarm-config project itself.

## Architecture Overview

### System Components

```
swarm-config/
├── .swarm/                     # Deployment Configuration
│   ├── kong.yaml              # Kong Routes, Services & global plugins
│   └── docker-compose.yaml    # Kong, Redis, UI Stack
│
├── stacks/                     # Infrastructure Stacks
│   ├── kong.yaml              # (deprecated, now in .swarm/)
│   ├── monitoring.yaml        # Prometheus/Grafana Stack
│   ├── portainer.yaml         # Portainer Stack
│   └── ...                    # Other Infrastructure Stacks
│
├── src/                        # TypeScript Source Code
│   ├── generate-kong-config.ts # Kong YAML Generator
│   ├── install-hooks.ts        # Git Hooks Installer
│   ├── Service.ts              # Service Builder
│   ├── Plugin.ts               # Plugin Builder
│   ├── DomainRegister.ts       # Domain Management
│   └── ...
│
├── server/                     # Nuxt Server (API Routes)
│   ├── api/                   # REST API Endpoints
│   └── utils/                 # Server Utilities (Kong generator, Git repos)
│
├── pages/                      # Nuxt Pages (Web UI)
│   ├── index.vue              # Dashboard
│   ├── login.vue              # Authentication
│   └── services/              # Service Management
│
├── scripts/                    # Setup & Deployment Scripts
│   ├── setup.sh               # Server Bootstrap (calls host-manager)
│   └── deploy-stack.sh        # Stack Deployment Helper
│
├── host-manager/               # Host Command Service (Port 3001)
│   ├── index.js               # Express Server
│   ├── commands/
│   │   └── setup/             # Setup Step Commands (01-13)
│   └── lib/
│       ├── defineSetupCommand.ts    # Command Pattern Definition
│       ├── setupState.ts            # State & Log Management
│       └── setupCommandRegistry.ts  # Command Registry
│
├── hooks/                      # Git Hook Templates
│   ├── post-receive           # Server-side Deployment
│   ├── pre-commit             # Local Code Quality
│   └── pre-push               # Local Tests
│
└── generated/
    └── kong.yaml              # Generated Kong Config (DO NOT EDIT)
```

### Data Flow

#### 1. Kong Configuration Generation

```
/var/apps/*/.swarm/kong.yaml # App-specific Kong configurations (YAML)
.swarm/kong.yaml             # swarm-config's own configuration + global plugins
                ↓
        generate-kong-config.ts
                ↓
        generated/kong.yaml
                ↓
            Kong reload
```

#### 2. App Deployment

```
git push production main
    ↓
post-receive hook
    ↓
Copy .swarm/kong.yaml → /var/apps/myapp/kong.yaml
Copy .swarm/docker-compose.yaml → /var/apps/myapp/docker-compose.yaml
    ↓
Docker build
    ↓
Docker deploy
    ↓
npm run kong:generate (Regenerate Kong)
```

#### 3. Server Bootstrap

```
scripts/setup.sh
    ↓
Initial setup:
- Clone repository
- Install & initialize Docker Swarm
- Start host-manager service
    ↓
host-manager API (port 3001)
    ↓
Setup Commands (13 steps):
 1. Configure security updates
 2. Get domain name
 3. Install Docker (already done)
 4. Install firewall (UFW)
 5. Create team users
 6. Configure SSH security
 7. Create Docker network
 8. Setup host-manager token
 9. Install msmtp
 9.5. Configure SMTP (manual)
 10. Deploy Kong
 11. Deploy Web UI
 12. Install GlusterFS (manual)
 13. Prepare apps directory (manual)
```

## Development Environment

### Prerequisites

- Node.js (current LTS version or higher)
- Git
- Docker (for local tests)
- TypeScript knowledge
- Bash knowledge (for Git hooks)

### Setup

```bash
# Clone repository
git clone https://github.com/jschirrmacher/swarm-config.git
cd swarm-config

# Install dependencies
npm install

# Install Git hooks
npm run install-hooks
```

### Available Scripts

```bash
npm run kong:generate    # Generate Kong YAML
npm run install-hooks    # Install Git hooks
npm run dev              # Start Web UI development server
npm run build            # Build Web UI for production
```

## Host-Manager Service

### Architecture

The host-manager is a TypeScript Express service running on port 3001 that provides a centralized interface for executing setup commands and other host operations. It runs as a Docker container with access to the host's Docker socket.

**Key Features:**

- Executes setup commands with idempotency checks
- Manages setup state and persistent logs
- Provides REST API for Web UI integration
- Secured with HOST_MANAGER_TOKEN authentication

**Directory Structure:**

```
host-manager/
├── index.js                    # Express server
├── commands/
│   └── setup/                  # Setup command definitions
│       ├── 01-configure-security-updates.ts
│       ├── 02-get-domain.ts
│       ├── 03-install-docker.ts
│       └── ... (13 steps total)
├── lib/
│   ├── defineSetupCommand.ts   # Command pattern & types
│   ├── setupState.ts           # State & log persistence
│   └── setupCommandRegistry.ts # Command registration
└── package.json
```

### Setup Command Pattern

Setup commands follow a consistent pattern defined by `defineSetupCommand`:

```typescript
// host-manager/commands/setup/XX-step-name.ts
import { defineSetupCommand } from "../../lib/defineSetupCommand"

export default defineSetupCommand({
  id: "XX-step-name",
  name: "Human-Readable Step Name",
  description: "What this step does",
  manualOnly: false, // true if requires user input

  // Optional: Input configuration for manual steps
  inputs: [
    {
      id: "fieldName",
      label: "Field Label",
      type: "text", // 'text' | 'password' | 'boolean' | 'select'
      required: true,
      options: ["option1", "option2"], // for type: 'select'
    },
  ],

  // Check if step is already completed (idempotency)
  async check() {
    // Return true if step is already done
    // Return false if step needs to run
  },

  // Execute the step
  async *execute(inputValues) {
    yield "Starting step..."

    // Use inputValues for manual steps
    // Yield log messages for UI display

    yield "Step completed"
  },

  // Optional: Pre-fill input values from system
  async getInputValues() {
    return {
      fieldName: "detected-value",
    }
  },
})
```

**Command Lifecycle:**

1. **Check Phase**: Verify if step is already completed
2. **Input Phase** (manual only): Get user input via Web UI
3. **Execute Phase**: Run the step, yield logs in real-time
4. **State Update**: Mark as completed or failed

### State Management

Setup state is persisted in `/var/lib/host-manager/setup-state.json`:

```json
{
  "steps": {
    "01-configure-security-updates": {
      "status": "completed",
      "logs": ["Step completed successfully"]
    },
    "09.5-configure-smtp": {
      "status": "pending",
      "inputValues": {
        "host": "smtp.example.com"
      }
    }
  }
}
```

**Log Persistence:**

Logs are also stored individually in `/var/lib/host-manager/logs/<step-id>.log`:

- Overwritten (not appended) when step re-runs
- Loaded from disk when Web UI is accessed
- Survives container restarts

### API Endpoints

```
GET  /setup/steps              # List all setup steps with status
POST /setup/run-step           # Execute a specific step
POST /setup/save-input-values  # Save input values for manual step
GET  /system/platform          # Get system platform info
```

**Authentication:**

All requests require `Authorization: Bearer <HOST_MANAGER_TOKEN>` header.

### Adding a New Setup Step

1. **Create Command File:**

```bash
touch host-manager/commands/setup/XX-my-step.ts
```

2. **Implement Command:**

```typescript
import { defineSetupCommand } from "../../lib/defineSetupCommand"
import { execSync } from "child_process"

export default defineSetupCommand({
  id: "XX-my-step",
  name: "My New Step",
  description: "Description of what this step does",

  async check() {
    try {
      execSync("command-to-check-if-done", { stdio: "ignore" })
      return true // Already done
    } catch {
      return false // Needs to run
    }
  },

  async *execute() {
    yield "Starting my step..."

    try {
      execSync("command-to-execute")
      yield "Step completed successfully"
    } catch (error) {
      yield `Error: ${error.message}`
      throw error
    }
  },
})
```

3. **Test Locally:**

```bash
# Restart host-manager
docker service update --force swarm-config_host-manager

# Check in Web UI
open http://localhost:3000/setup
```

4. **Numbering Convention:**
   - Use sequential numbers (01, 02, 03, ...)
   - Use decimal for inserted steps (09.5 for step between 09 and 10)
   - Manual-only steps typically at the end or between automated steps

5. **Commit:**

```bash
git add host-manager/commands/setup/XX-my-step.ts
git commit -m "feat: add setup step XX - my step"
```

## Code Structure

### TypeScript Conventions

#### 1. No explicit types when inferable

```typescript
// ❌ Redundant
function getData(): Promise<string> {
  return Promise.resolve("data")
}

// ✅ Type is inferred
function getData() {
  return Promise.resolve("data")
}
```

#### 2. Interfaces for Contracts

```typescript
// Interfaces for public contracts
export interface CheckResult {
  name: string
  passed: boolean
  message: string
  fix?: () => Promise<void>
}

// Type for unions/aliases
export type BumpType = "major" | "minor" | "patch"
```

#### 3. Type Imports

```typescript
// For type-only imports
import type { SomeType } from "./module.ts"

// For runtime + type
import { someFunction, type SomeType } from "./module.ts"
```

### Modular Design

#### 1. Kong Configuration (YAML)

Developers manage Kong configuration via YAML in their repositories:

```yaml
# App repository: .swarm/kong.yaml
services:
  - name: example_example
    url: http://example_example:3000

routes:
  - name: example_example
    hosts:
      - example.justso.de
    paths:
      - /
    protocols:
      - https
    preserve_host: true
    service: example_example

plugins:
  - name: rate-limiting
    config:
      minute: 100
```

This file is copied to `/var/apps/example/kong.yaml` on deployment.

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

### Local Kong Tests

```bash
# Generate Kong YAML
npm run kong:generate

# Validate
docker run --rm -v $PWD/generated:/config kong:3.0 \
  kong config parse /config/kong.yaml
```

### Docker Stack Tests

```bash
# Deploy stack locally
docker swarm init  # If not already initialized
docker stack deploy -c compose.yaml test-swarm-config

# Cleanup
docker stack rm test-swarm-config
```

## Deployment Workflow

### 1. Develop Feature

```bash
git checkout -b feature/new-check
# Make changes
npm run kong:generate  # If Kong config affected
git add .
git commit -m "feat: add new check"
```

### 2. Test

```bash
# Validate Kong config
npm run kong:generate
```

### 3. Pull Request

```bash
git push origin feature/new-check
# Create PR on GitHub
```

### 4. Merge and Deploy

```bash
git checkout main
git merge feature/new-check
git push origin main
```

### 5. Update Server

```bash
ssh justso.de
cd /var/apps/swarm-config
git pull
npm install
npm run kong:generate
```

## Adding New Features

### Customize Standard Plugins

The standard plugins (acme, bot-detection, request-size-limiting) are defined directly in `.swarm/kong.yaml`:

```yaml
# .swarm/kong.yaml
plugins:
  - name: acme
    config:
      account_email: ${TECH_EMAIL}
      # ...
  - name: bot-detection
  - name: request-size-limiting
    config:
      allowed_payload_size: 10
      size_unit: megabytes
```

**Notes:**

- These plugins apply globally to all services
- Make changes directly in `.swarm/kong.yaml`
- Environment variables with `${VAR_NAME}` syntax
- ACME domains are automatically set in `kongConfig.ts`

### New Optional Global Plugin

Optional plugins (like Prometheus) are defined as commented entries in `.swarm/kong.yaml`:

```yaml
# .swarm/kong.yaml
plugins:
  # Standard plugins (acme, bot-detection, request-size-limiting)

  # Optional: Prometheus Plugin for monitoring
  - name: prometheus
    config:
      status_code_metrics: true
      latency_metrics: true
      bandwidth_metrics: true
      upstream_health_metrics: true
```

**Activation:**

1. Add plugin entry in `.swarm/kong.yaml` (as shown above)
2. Run `npm run kong:generate`

**Notes:**

- All plugins in `.swarm/kong.yaml` apply globally
- Environment variables with `${VAR_NAME}` syntax possible
- ACME domains are automatically set in `kongConfig.ts`

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
// ✅ Parallel execution where possible
const [services, plugins] = await Promise.all([loadModules("services"), loadModules("plugins")])

// ❌ Sequential without necessity
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

## Documentation

### README Updates

Always update README.md for new features:

- What does the feature do?
- How is it used?
- What configuration is needed?
- Add examples

## Support

For questions or issues:

- GitHub Issues: https://github.com/jschirrmacher/swarm-config/issues

## License

Apache-2.0 - see LICENSE file
