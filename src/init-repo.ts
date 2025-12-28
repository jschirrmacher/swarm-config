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
 * - Creates a bare Git repository in /opt/git/
 * - Sets up post-receive hook for CI/CD
 * - Creates working directory in /var/apps/
 * - Configures automatic deployment on git push
 * - Creates Kong service configuration
 */

import { existsSync } from "fs"
import { mkdir, writeFile, copyFile, chmod } from "fs/promises"
import { resolve } from "path"
import { execAsync } from "./bootstrap-helpers.ts"
import * as readline from "readline"
import { config } from "./config.ts"

const BRANCH = "main"
const GIT_BASE_DIR = "/opt/git"
const APP_BASE_DIR = "/var/apps"
const SWARM_CONFIG_DIR = "/var/apps/swarm-config"

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
# Edit these values according to your application needs

NODE_ENV=production
PORT=3000

# Add your application-specific variables below:
# DATABASE_URL=
# API_KEY=
# etc.
`

  await writeFile(envFile, envContent)
  console.log(`⚠️  Don't forget to edit ${envFile} with your configuration!`)
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
    // Create bare repository
    const gitDir = await createBareRepository(appName)

    // Install post-receive hook
    await installPostReceiveHook(gitDir)

    // Create application directory
    const appDir = await createAppDirectory(appName)

    // Create .env template
    await createEnvTemplate(appDir)

    // Configure Kong Gateway
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
    console.log(`   git remote add production git@${config.SERVER_HOST}:/opt/git/${appName}.git`)
    console.log("")
    console.log("3. Push your code to trigger deployment:")
    console.log(`   git push production ${BRANCH}`)
    console.log("")
    console.log("4. Check deployment status:")
    console.log(`   ssh ${config.SERVER_HOST} 'docker service ps ${appName}_${appName}'`)
    console.log("")
    console.log("5. View application logs:")
    console.log(`   ssh ${config.SERVER_HOST} 'docker service logs -f ${appName}_${appName}'`)
    console.log("")
  } catch (error) {
    console.error("❌ Setup failed:", error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
