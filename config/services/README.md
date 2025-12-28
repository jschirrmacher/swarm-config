# Service Definitions

This directory contains individual TypeScript files for each deployed service.

## Structure

Each file exports a service configuration using the `createStack()` API:

```typescript
// services/myapp.ts
import { createStack } from "../src/Service.js"

export default createStack("myapp").addService("myapp", 3000).addRoute("myapp.justso.de")
```

## Examples

Check out these example files for different configuration patterns:

- **func.ts.example** - Simple Node.js service
- **my-small-application.ts.example** - App with separate API route (path-based routing)
- **nginx.ts.example** - Static site with domain redirections
- **owncloud.ts.example** - Basic file hosting service

To use an example, copy it and remove the `.example` extension:

```bash
cp func.ts.example myapp.ts
# Then edit myapp.ts for your needs
```

## Automatic Generation

When you create a repository through the Web UI or API, it automatically creates `services/myapp.ts`.

## Manual Configuration

You can manually create or edit files here to add:

- Additional routes (multiple domains, path-based routing)
- Custom plugins (rate limiting, authentication, cors, etc.)
- Redirections
- Custom service configurations

## Advanced Examples

### Multiple Routes

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
  .addRoute("myapp.justso.de", {
    paths: ["/api"],
    strip_path: true,
    name: "myapp-api",
  })
```

### With Rate Limiting

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
  .addPlugin("rate-limiting", {
    minute: 100,
    hour: 5000,
  })
```

### With CORS Configuration

```typescript
export default createStack("myapp")
  .addService("myapp", 3000)
  .addRoute("myapp.justso.de")
  .addPlugin("cors", {
    origins: ["https://myapp.justso.de", "https://other-domain.com"],
    credentials: true,
  })
```

## How It Works

The `generate-kong-config.ts` script automatically discovers and loads all `.ts` files from this directory and merges them with the global configuration from `config.ts`.
