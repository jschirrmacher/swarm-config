import { readFileSync } from "fs"
import { resolve } from "path"

interface SwarmConfig {
  DOMAIN: string
  SERVER_HOST: string
  HOOKS_BASE_URL: string
}

let cachedConfig: SwarmConfig | null = null

/**
 * Reads the .swarm-config file and returns the configuration values
 */
export function getSwarmConfig(): SwarmConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const configPath = resolve(process.cwd(), ".swarm-config")

  try {
    const content = readFileSync(configPath, "utf-8")
    const config: SwarmConfig = {
      DOMAIN: "",
      SERVER_HOST: "",
      HOOKS_BASE_URL: "",
    }

    // Parse .swarm-config file
    content.split("\n").forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=")
        const value = valueParts.join("=").trim()

        if (key === "DOMAIN") {
          config.DOMAIN = value
        } else if (key === "SERVER_HOST") {
          config.SERVER_HOST = value
        } else if (key === "HOOKS_BASE_URL") {
          config.HOOKS_BASE_URL = value
        }
      }
    })

    // Validate required fields
    if (!config.DOMAIN) {
      throw new Error("DOMAIN not set in .swarm-config")
    }
    if (!config.SERVER_HOST) {
      throw new Error("SERVER_HOST not set in .swarm-config")
    }

    cachedConfig = config
    return config
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(".swarm-config file not found. Please create it from .swarm-config.example")
    }
    throw error
  }
}

/**
 * Returns the base domain from configuration
 */
export function getDomain(): string {
  return getSwarmConfig().DOMAIN
}

/**
 * Returns the server hostname from configuration
 */
export function getServerHost(): string {
  return getSwarmConfig().SERVER_HOST
}

/**
 * Returns the hooks base URL from configuration
 */
export function getHooksBaseUrl(): string {
  return getSwarmConfig().HOOKS_BASE_URL
}
