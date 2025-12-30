#!/usr/bin/env tsx
/**
 * Server Configuration
 *
 * Reads configuration from .swarm-config file or environment variables
 */

import { readFileSync, writeFileSync, existsSync } from "fs"
import { resolve } from "path"

interface Config {
  DOMAIN: string
}

let cachedConfig: Config | null = null

/**
 * Reads the .swarm-config file and returns the configuration values
 */
export function getSwarmConfig(): Config {
  if (cachedConfig) {
    return cachedConfig
  }

  const configPath = resolve(process.cwd(), ".swarm-config")
  const defaults: Config = {
    DOMAIN: process.env.DOMAIN || "example.com",
  }

  // If no config file exists, return defaults
  if (!existsSync(configPath)) {
    console.warn("⚠️  No .swarm-config file found. Using defaults.")
    console.warn("   Run the setup.sh script to configure your domain.")
    cachedConfig = defaults
    return defaults
  }

  try {
    const content = readFileSync(configPath, "utf-8")
    const config: Partial<Config> = {}

    content.split("\n").forEach(line => {
      line = line.trim()
      if (line && !line.startsWith("#")) {
        const [key, ...valueParts] = line.split("=")
        const value = valueParts.join("=").trim()
        if (key && value) {
          config[key as keyof Config] = value as any
        }
      }
    })

    // Validate required fields
    if (!config.DOMAIN && !defaults.DOMAIN) {
      throw new Error("DOMAIN not set in .swarm-config")
    }

    // Merge with defaults
    const mergedConfig: Config = {
      DOMAIN: config.DOMAIN || defaults.DOMAIN,
    }

    cachedConfig = mergedConfig
    return mergedConfig
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as any).code === "ENOENT") {
      throw new Error(".swarm-config file not found. Run setup.sh to create it.")
    }
    throw error
  }
}

/**
 * Saves configuration to .swarm-config file
 */
export function saveSwarmConfig(config: Config): void {
  const configPath = resolve(process.cwd(), ".swarm-config")
  
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
