#!/usr/bin/env tsx
/**
 * Server Configuration
 *
 * Reads configuration from .swarm-config file or environment variables
 */

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"

interface Config {
  DOMAIN: string
  SERVER_HOST: string
  HOOKS_BASE_URL: string
}

function loadConfig(): Config {
  const configPath = resolve(process.cwd(), ".swarm-config")
  const defaults: Config = {
    DOMAIN: process.env.DOMAIN || "example.com",
    SERVER_HOST: process.env.SERVER_HOST || "server.example.com",
    HOOKS_BASE_URL: process.env.HOOKS_BASE_URL || "",
  }

  // If no config file exists, return defaults
  if (!existsSync(configPath)) {
    console.warn("⚠️  No .swarm-config file found. Using defaults.")
    console.warn("   Copy .swarm-config.example to .swarm-config and configure your domain.")
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
          config[key as keyof Config] = value
        }
      }
    })

    // Merge with defaults
    return {
      DOMAIN: config.DOMAIN || defaults.DOMAIN,
      SERVER_HOST: config.SERVER_HOST || defaults.SERVER_HOST,
      HOOKS_BASE_URL:
        config.HOOKS_BASE_URL || `https://${config.SERVER_HOST || defaults.SERVER_HOST}/scripts`,
    }
  } catch (error) {
    console.error("❌ Error reading .swarm-config:", error)
    return defaults
  }
}

export const config = loadConfig()
