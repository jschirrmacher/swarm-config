# Server Configuration

This file contains server-specific configuration that should not be committed to git.

## Setup

1. Copy `.swarm-config.example` to `.swarm-config`
2. Edit `.swarm-config` with your domain and server settings
3. Configuration will be automatically loaded by the scripts

## Configuration Values

- **DOMAIN**: Your base domain (e.g., `example.com`)
  - Apps will be available at `<appname>.<DOMAIN>`
  - Example: If DOMAIN=example.com, myapp will be at myapp.example.com

- **SERVER_HOST**: Your server hostname for SSH access (e.g., `server.example.com`)
  - Used for `git push` and SSH commands in documentation

- **HOOKS_BASE_URL**: Base URL for downloading git hooks (optional)
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
