#!/usr/bin/env node
import { docker, networkExists } from '../lib/docker.js'

console.log('🌐 Step 6: Creating Kong network...')

try {
  if (networkExists('kong-net')) {
    console.log('✅ kong-net network already exists')
  } else {
    docker('network create --scope=swarm --attachable -d overlay kong-net')
    console.log('✅ kong-net network created')
  }
} catch (error) {
  console.error('❌ Failed to create network')
  process.exit(1)
}

console.log('')
