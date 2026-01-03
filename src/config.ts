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

// Legacy export for backward compatibility
export const config = getSwarmConfig()
