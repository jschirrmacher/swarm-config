#!/usr/bin/env tsx
/**
 * Server Setup Script
 *
 * Sets up a new Git repository with CI/CD deployment
 * Run this on the server to configure a new application
 *
 * Usage:
 *   npm run server-setup <appname>
 *
 * Example:
 *   npm run server-setup myapp
 *
 * This script:
 * - Creates a bare Git repository in /home/<user>/
 * - Sets up post-receive hook for CI/CD
 * - Creates working directory in /var/apps/
 * - Configures automatic deployment on git push
 * - Creates Kong service configuration
 */

import "dotenv/config"
import { existsSync } from "fs"
import { mkdir, writeFile, copyFile, chmod } from "fs/promises"
import { resolve } from "path"
import { exec } from "child_process"
import { promisify } from "util"
import * as readline from "readline"
import { config } from "./config.js"

const execAsync = promisify(exec)

const BRANCH = "main"
const GIT_BASE_DIR = process.env.GIT_REPO_BASE || "/home"
const APP_BASE_DIR = process.env.WORKSPACE_BASE || "/var/apps"
const SWARM_CONFIG_DIR = `${APP_BASE_DIR}/swarm-config`

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

async function confirm(question: string): Promise<boolean> {
  const rl = createReadlineInterface()

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close()
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes")
    })
  })
}

async function createBareRepository(appName: string) {
  const gitDir = resolve(GIT_BASE_DIR, `${appName}.git`)

  if (existsSync(gitDir)) {
    console.log(`⚠️  Repository already exists: ${gitDir}`)
    const shouldContinue = await confirm("Do you want to continue and update hooks? (y/n) ")

    if (!shouldContinue) {
      process.exit(0)
    }
    return gitDir
  }

  console.log(`📁 Creating bare repository: ${gitDir}`)
  await mkdir(gitDir, { recursive: true })
  await execAsync(`cd ${gitDir} && git init --bare`)

  return gitDir
}

async function installPostReceiveHook(gitDir: string) {
  console.log("🔗 Installing post-receive hook...")

  const hookSource = resolve(SWARM_CONFIG_DIR, "hooks", "post-receive")
  const hookTarget = resolve(gitDir, "hooks", "post-receive")

  if (!existsSync(hookSource)) {
    console.error("❌ Could not find post-receive hook!")
    console.error(`   Expected location: ${hookSource}`)
    process.exit(1)
  }

  await copyFile(hookSource, hookTarget)
  await chmod(hookTarget, 0o755)
  console.log(`✅ Installed hook from ${SWARM_CONFIG_DIR}`)
}

async function createAppDirectory(appName: string) {
  const appDir = resolve(APP_BASE_DIR, appName)

  console.log(`📁 Creating application directory: ${appDir}`)
  await mkdir(appDir, { recursive: true })

  return appDir
}

async function createEnvTemplate(appDir: string) {
  const envFile = resolve(appDir, ".env")

  if (existsSync(envFile)) {
    return
  }

  console.log("📝 Creating .env template...")

  const envContent = `# Environment variables for deployment

# Application settings
NODE_ENV=production
PORT=3000

# Docker Compose settings
VERSION=latest
DATA_PATH=./data
ENV_FILE=./.env

# Network (will be overridden to "kong-net" on server deployment)
NETWORK_NAME=default

# Add your application-specific variables below:
# DATABASE_URL=
# API_KEY=
# etc.
`

  await writeFile(envFile, envContent)
  console.log(`⚠️  Don't forget to edit ${envFile} with your configuration!`)
}

async function createCopilotInstructions(appDir: string) {
  const githubDir = resolve(appDir, ".github")
  const instructionsFile = resolve(githubDir, "copilot-instructions.md")

  if (existsSync(instructionsFile)) {
    return
  }

  console.log("📝 Creating GitHub Copilot instructions...")

  await mkdir(githubDir, { recursive: true })

  const instructionsContent = `# GitHub Copilot Instructions

## General Guidelines

- **Never automatically commit or push changes** - Always show changes and wait for explicit user confirmation before running git commands

## Code Style

- Use concise, descriptive variable names
- Prefer functional programming patterns where appropriate
- Add comments for complex logic
- Keep functions small and focused
`

  await writeFile(instructionsFile, instructionsContent)
  console.log(`✅ Created ${instructionsFile}`)
}

async function createKongYaml(appDir: string, appName: string) {
  const kongFile = resolve(appDir, "kong.yaml")

  if (existsSync(kongFile)) {
    console.log("⚠️  kong.yaml already exists, skipping")
    return
  }

  console.log("📝 Creating kong.yaml template...")

  const domain = `${appName}.${config.DOMAIN}`
  const kongContent = `# Kong Gateway Configuration for ${appName}

services:
  - name: ${appName}_${appName}
    url: http://${appName}_${appName}:3000
    routes:
      - name: ${appName}-main
        hosts:
          - ${domain}
        paths:
          - /
        protocols:
          - http
          - https
        preserve_host: true
        strip_path: false
`

  await writeFile(kongFile, kongContent)
  console.log(`✅ Created ${kongFile}`)
}

async function createComposeYaml(appDir: string, appName: string) {
  const composeFile = resolve(appDir, "compose.yaml")

  if (existsSync(composeFile)) {
    console.log("⚠️  compose.yaml already exists, skipping")
    return
  }

  console.log("📝 Creating compose.yaml template...")

  const composeContent = `services:
  ${appName}:
    image: ${appName}:\${VERSION:-latest}
    volumes:
      - \${DATA_PATH:-./data}:/app/data
    env_file:
      - \${ENV_FILE:-./.env}
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
        failure_action: rollback
      rollback_config:
        parallelism: 1
        delay: 5s
      placement:
        constraints:
          - node.role == manager
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"]
      interval: 30s
      timeout: 3s
      start_period: 5s
      retries: 3
    networks:
      - \${NETWORK_NAME:-default}

networks:
  default:
  kong-net:
    external: true
`

  await writeFile(composeFile, composeContent)
  console.log(`✅ Created ${composeFile}`)
}

async function configureKong(appName: string) {
  const domain = `${appName}.${config.DOMAIN}`
  const servicesDir = resolve(SWARM_CONFIG_DIR, "config", "services")
  const serviceFile = resolve(servicesDir, `${appName}.ts`)

  console.log(`Konfiguriere Kong Gateway für ${domain}...`)

  // Create services directory if it doesn't exist
  if (!existsSync(servicesDir)) {
    await mkdir(servicesDir, { recursive: true })
  }

  // Check if service file already exists
  if (existsSync(serviceFile)) {
    console.log(`⚠ Service '${appName}' existiert bereits: ${serviceFile}`)
    return
  }

  // Create service definition file
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, " UTC")
  const serviceContent = `import { createStack } from "../../src/Service.js"

// Auto-generated service configuration for ${appName}
// Created: ${timestamp}
// Feel free to customize this file with additional routes, plugins, etc.

export default createStack("${appName}")
  .addService("${appName}", 3000)
  .addRoute("${domain}")
`

  await writeFile(serviceFile, serviceContent)
  console.log(`✓ Service-Definition erstellt: ${serviceFile}`)

  // Regenerate Kong configuration
  console.log("Regeneriere Kong-Konfiguration...")

  try {
    await execAsync(`cd ${SWARM_CONFIG_DIR} && npm run kong:generate`)
    console.log("✓ Kong-Konfiguration regeneriert")
  } catch (error) {
    console.log("⚠ Kong-Konfiguration konnte nicht regeneriert werden")
    console.log(`  Bitte manuell ausführen: cd ${SWARM_CONFIG_DIR} && npm run kong:generate`)
    return
  }

  console.log("")
  console.log(`Service ist erreichbar unter: https://${domain}`)
}

async function createInitialCommit(appDir: string, appName: string) {
  console.log("📝 Creating initial commit with templates...")

  try {
    await execAsync(`cd ${appDir} && git init`)
    await execAsync(`cd ${appDir} && git checkout -b ${BRANCH}`)
    await execAsync(`cd ${appDir} && git add .env .github/ kong.yaml compose.yaml`)
    await execAsync(`cd ${appDir} && git commit -m "chore: initial project setup with templates"`)

    const gitDir = resolve(GIT_BASE_DIR, `${appName}.git`)
    await execAsync(`cd ${appDir} && git remote add origin ${gitDir}`)
    await execAsync(`cd ${appDir} && git push -u origin ${BRANCH}`)

    console.log("✅ Initial commit created and pushed")
  } catch (error) {
    console.log("⚠️  Could not create initial commit")
    console.log(`   Error: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`   You can manually commit and push the template files later`)
  }
}

async function main() {
  const appName = process.argv[2]

  if (!appName) {
    console.error("Usage: npm run init-repo <appname>")
    console.error("")
    console.error("Example: npm run init-repo myapp")
    process.exit(1)
  }

  console.log("================================================")
  console.log(`🚀 Setting up Git CI/CD for: ${appName}`)
  console.log("================================================")
  console.log("")

  try {
    const gitDir = await createBareRepository(appName)
    await installPostReceiveHook(gitDir)

    const appDir = await createAppDirectory(appName)
    await createEnvTemplate(appDir)
    await createCopilotInstructions(appDir)
    await createKongYaml(appDir, appName)
    await createComposeYaml(appDir, appName)
    await createInitialCommit(appDir, appName)
    await configureKong(appName)

    console.log("")
    console.log("================================================")
    console.log("✅ Setup complete!")
    console.log("================================================")
    console.log("")
    console.log("📋 Next steps:")
    console.log("")
    console.log("1. Edit environment variables:")
    console.log(`   nano ${appDir}/.env`)
    console.log("")

    console.log("2. On your local machine, add the remote:")
    console.log(`   git remote add production git@${config.DOMAIN}:~/${appName}.git`)
    console.log("")
    console.log("3. Push your code to trigger deployment:")
    console.log(`   git push production ${BRANCH}`)
    console.log("")
    console.log("4. Check deployment status:")
    console.log(`   ssh ${config.DOMAIN} 'docker service ps ${appName}_${appName}'`)
    console.log("")
    console.log("5. View application logs:")
    console.log(`   ssh ${config.DOMAIN} 'docker service logs -f ${appName}_${appName}'`)
    console.log("")
  } catch (error) {
    console.error("❌ Setup failed:", error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
