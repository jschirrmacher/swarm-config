import { readFileSync, existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs'
import { dirname } from 'path'

const CONFIG_PATH = '/var/apps/swarm-config/.swarm-config'

export interface Config {
  DOMAIN: string
}

/**
 * Load domain from .swarm-config file
 */
export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`Configuration file not found: ${CONFIG_PATH}`)
  }

  const content = readFileSync(CONFIG_PATH, 'utf-8')
  const match = content.match(/^DOMAIN=(.+)$/m)
  
  if (!match) {
    throw new Error('DOMAIN not found in configuration file')
  }

  return {
    DOMAIN: match[1]
  }
}

/**
 * Save configuration to .swarm-config file
 */
export function saveConfig(config: Config): void {
  const dir = dirname(CONFIG_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  const content = `# Swarm Config Configuration
# Domain for this server
DOMAIN=${config.DOMAIN}

# Generated on: ${new Date().toISOString()}
`

  writeFileSync(CONFIG_PATH, content, 'utf-8')
  chmodSync(CONFIG_PATH, 0o644)
}
