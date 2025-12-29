#!/usr/bin/env node
import { exec, docker, stackExists, waitForService } from '../lib/docker.js'
import { existsSync, mkdirSync, chownSync, chmodSync } from 'fs'

console.log('🦍 Step 7: Deploying Kong API Gateway...')

const workDir = '/var/apps/swarm-config'
process.chdir(workDir)

// Ensure redis-data directory exists with correct permissions
console.log('  Setting up Redis data directory...')
const redisDataDir = `${workDir}/redis-data`
if (!existsSync(redisDataDir)) {
  mkdirSync(redisDataDir, { recursive: true })
}
chownSync(redisDataDir, 1001, 1001)
chmodSync(redisDataDir, 0o755)

// Generate Kong configuration
console.log('  Generating Kong configuration...')
try {
  exec('npx tsx src/generate-kong-config.ts')
} catch (error) {
  console.error('❌ Failed to generate Kong configuration')
  process.exit(1)
}

// Check if Kong stack already exists and remove it if needed
if (stackExists('kong')) {
  console.log('  Removing existing Kong stack...')
  docker('stack rm kong')
  console.log('  Waiting for services to be removed...')
  exec('sleep 10')
}

// Deploy Kong stack
console.log('  Deploying Kong stack...')
try {
  docker('stack deploy --detach=false -c config/stacks/kong.yaml kong')
} catch (error) {
  console.error('❌ Failed to deploy Kong stack')
  process.exit(1)
}

// Wait for Kong to be ready
waitForService('kong_kong')

console.log('')
