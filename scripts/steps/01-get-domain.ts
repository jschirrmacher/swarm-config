#!/usr/bin/env node
import { saveConfig, loadConfig } from '../lib/config.js'
import { existsSync } from 'fs'

console.log('🌐 Step 1: Getting domain configuration...')

const configPath = '/var/apps/swarm-config/.swarm-config'

// Check if config already exists
if (existsSync(configPath)) {
  const config = loadConfig()
  console.log(`  Using existing domain: ${config.DOMAIN}`)
  process.env.DOMAIN = config.DOMAIN
} else {
  // Get domain from environment (set by setup.sh)
  const domain = process.env.SWARM_DOMAIN

  if (!domain) {
    console.error('❌ Domain is required but not provided')
    console.error('   Run with: curl ... | sudo bash -s your-domain.com')
    process.exit(1)
  }

  // Save to config file
  saveConfig({ DOMAIN: domain })
  process.env.DOMAIN = domain
  console.log(`  Domain set to: ${domain}`)
}

console.log(`✅ Domain configured: ${process.env.DOMAIN}`)
console.log('')
