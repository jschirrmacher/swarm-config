import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs'

const ENV_PATH = '/var/apps/swarm-config/.env'

export interface Config {
  DOMAIN: string
}

/**
 * Load domain from .env file
 */
export function loadConfig(): Config {
  if (!existsSync(ENV_PATH)) {
    throw new Error(`Configuration file not found: ${ENV_PATH}`)
  }

  const content = readFileSync(ENV_PATH, 'utf-8')
  const match = content.match(/^DOMAIN=(.+)$/m)
  
  if (!match || !match[1]) {
    throw new Error('DOMAIN not found in .env file')
  }

  return {
    DOMAIN: match[1]
  }
}

/**
 * Save configuration to .env file
 */
export function saveConfig(config: Config): void {
  // Append DOMAIN to .env if it doesn't exist
  let content = ''
  
  if (existsSync(ENV_PATH)) {
    content = readFileSync(ENV_PATH, 'utf-8')
    
    // Check if DOMAIN already exists
    if (/^DOMAIN=/m.test(content)) {
      // Replace existing DOMAIN
      content = content.replace(/^DOMAIN=.+$/m, `DOMAIN=${config.DOMAIN}`)
      writeFileSync(ENV_PATH, content, 'utf-8')
      return
    }
  }
  
  // Append DOMAIN
  appendFileSync(ENV_PATH, `\nDOMAIN=${config.DOMAIN}\n`, 'utf-8')
}
