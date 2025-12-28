# Server Configuration

This file contains server-specific configuration that should not be committed to git.

## Setup

1. Create `.swarm-config` file with your domain:
   ```bash
   echo "DOMAIN=example.com" > .swarm-config
   ```

2. Or run the initial setup script which will prompt you:
   ```bash
   ./scripts/initial-setup.sh
   ```

3. Configuration will be automatically loaded by the scripts

## Configuration Values

- **DOMAIN**: Your base domain (e.g., `example.com`)
  - Apps will be available at `<appname>.<DOMAIN>`
  - Example: If DOMAIN=example.com, myapp will be at myapp.example.com
  - Also used for SSH access and git remote URLs
  - Defaults to `https://${SERVER_HOST}/scripts`
  - Used by install-hooks.ts to download pre-commit and pre-push hooks

## Environment Variables

You can also set these values via environment variables instead of using `.swarm-config`:

```bash
export DOMAIN=example.com
export SERVER_HOST=server.example.com
export HOOKS_BASE_URL=https://server.example.com/scripts
```

Environment variables take precedence over `.swarm-config` file values.
