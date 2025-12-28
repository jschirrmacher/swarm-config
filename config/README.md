# Kong Configuration

This directory contains all Kong Gateway configuration split into modular components.

## Structure

```
config/
├── services/          # Application services (auto-deployed apps)
├── infrastructure/    # Infrastructure services (Portainer, Monitoring, etc.)
├── plugins/          # Global Kong plugins
└── consumers/        # Authentication consumers
```

## How It Works

When you run `npm run kong:generate`, the script automatically:
1. Loads all `.ts` files from each subdirectory
2. Merges them into a single Kong configuration
3. Generates `generated/kong.yaml`

## Adding Configuration

### Services (Auto-deployed apps)
Services are automatically created when you run `npm run init-repo`:
```bash
npm run init-repo myapp
# Creates config/services/myapp.ts
```

### Infrastructure Services
Manually create files in `config/infrastructure/`:
```typescript
// config/infrastructure/portainer.ts
import { createPortainerStack } from "../../src/PortainerStack.js"

export default createPortainerStack("portainer", "portainer.example.com")
```

### Global Plugins
Create files in `config/plugins/`:
```typescript
// config/plugins/acme.ts
import { createAcmePlugin, createRedisStorage } from "../../src/Plugin.js"

export default createAcmePlugin("tech@example.com", [createRedisStorage()])
```

### Consumers
Create files in `config/consumers/`:
```typescript
// config/consumers/joachim.ts
export default {
  username: "joachim",
  consumerName: "joachim", 
  password: "your-secure-password"
}
```

## Examples

Check the `.example` files in each subdirectory for working examples.
