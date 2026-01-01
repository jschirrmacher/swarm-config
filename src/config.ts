#!/usr/bin/env tsx
/**
 * Server Configuration
 *
 * Reads configuration from environment variables (.env file)
 */

interface Config {
  DOMAIN: string
}

/**
 * Returns the configuration from environment variables
 */
export function getSwarmConfig(): Config {
  const domain = process.env.DOMAIN
  
  if (!domain) {
    throw new Error("DOMAIN not set in environment variables. Check your .env file.")
  }

  return {
    DOMAIN: domain,
  }
}

/**
 * Returns the domain from environment variables
 */
export function getDomain(): string {
  return getSwarmConfig().DOMAIN
}
  
  const content = `# Swarm Config Configuration
# Generated on: ${new Date().toISOString()}

DOMAIN=${config.DOMAIN}
`

  writeFileSync(configPath, content, "utf-8")
  
  // Clear cache to force reload
  cachedConfig = null
}

/**
 * Returns the base domain from configuration
 */
export function getDomain(): string {
  return getSwarmConfig().DOMAIN
}

// Legacy export for backward compatibility
export const config = getSwarmConfig()
