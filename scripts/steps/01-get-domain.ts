#!/usr/bin/env node
import { saveConfig, loadConfig } from "../lib/config.js"
import { runStep } from "../lib/step.js"
import { existsSync } from "fs"

await runStep("01-get-domain", "Getting domain configuration...", async () => {
  const envPath = "/var/apps/swarm-config/.env"

  // Check if DOMAIN already exists in .env
  if (existsSync(envPath)) {
    try {
      const config = loadConfig()
      console.log(`  Using existing domain: ${config.DOMAIN}`)
      process.env.DOMAIN = config.DOMAIN
    } catch (error) {
      // DOMAIN not in .env yet, will be added below
    }
  }

  if (!process.env.DOMAIN) {
    // Get domain from environment (set by setup.sh)
    const domain = process.env.SWARM_DOMAIN

    if (!domain) {
      throw new Error(
        "Domain is required but not provided. Run with: curl ... | sudo bash -s your-domain.com",
      )
    }

    // Save to .env file
    saveConfig({ DOMAIN: domain })
    process.env.DOMAIN = domain
    console.log(`  Domain set to: ${domain}`)
  }

  console.log(`✅ Domain configured: ${process.env.DOMAIN}`)
})
