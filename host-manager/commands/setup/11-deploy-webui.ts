import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "11-deploy-webui",
  name: "Deploy/Update Swarm Config Stack",
  description:
    "Pull latest code, build images, and deploy complete stack (Kong, Redis, Web UI, host-manager)",

  async check() {
    try {
      const services = (await executeOnHost("docker service ls --filter name=swarm-config_ui -q"))
        .stdout
      return services.trim().length > 0
    } catch {
      return false
    }
  },

  async *execute() {
    const workDir = "/var/apps/swarm-config"
    const branch = process.env.BRANCH || "main"

    // Pull latest code from git
    try {
      const statusResult = await executeOnHost(`cd ${workDir} && git status --porcelain`)
      const hasChanges = statusResult.stdout.trim().length > 0

      if (hasChanges) {
        yield "💾 Stashing uncommitted changes..."
        await executeOnHost(`cd ${workDir} && git stash push -m "Auto-stash before update"`)
      }

      yield `🔄 Checking for code updates (branch: ${branch})...`
      const pullResult = await executeOnHost(`cd ${workDir} && git pull origin ${branch}`)
      if (pullResult.stdout.includes("Already up to date")) {
        yield "✅ Code is up to date"
      } else {
        yield "✅ Code updated"
      }
    } catch (error) {
      yield "⚠️  Git pull failed, continuing with existing code..."
    }

    yield "🔨 Building host-manager Docker image..."
    try {
      await executeOnHost(`cd ${workDir}/host-manager && docker build -t host-manager:latest .`)
    } catch (error) {
      yield "⚠️  host-manager build failed, but continuing..."
    }

    yield "🔨 Building Web UI Docker image..."
    await executeOnHost(`cd ${workDir} && docker build -t swarm-config-ui:latest .`)

    const imageExists = async (name: string) => {
      try {
        await executeOnHost(`docker images -q ${name}:latest`)
        return true
      } catch {
        return false
      }
    }

    if (!(await imageExists("swarm-config-ui"))) {
      throw new Error("Web UI image not available")
    }

    yield "📦 Distributing images to swarm nodes..."

    const workerNodes = (
      await executeOnHost("docker node ls --filter role=worker -q 2>/dev/null || true")
    ).stdout.trim()

    if (workerNodes) {
      yield "Copying images to worker nodes..."
      for (const node of workerNodes.split("\n").filter(Boolean)) {
        try {
          const nodeIp = (
            await executeOnHost(
              `docker node inspect "${node}" --format '{{.Status.Addr}}' 2>/dev/null || true`,
            )
          ).stdout.trim()

          if (nodeIp) {
            yield `  → ${nodeIp}`

            if (await imageExists("host-manager")) {
              await executeOnHost(
                `docker save host-manager:latest | ssh "${nodeIp}" docker load 2>/dev/null || true`,
              )
            }

            await executeOnHost(
              `docker save swarm-config-ui:latest | ssh "${nodeIp}" docker load 2>/dev/null || true`,
            )
          }
        } catch {
          // Continue with other nodes
        }
      }
    }

    const envContent = (await executeOnHost(`cat ${workDir}/.env`)).stdout
    const domain = envContent.match(/DOMAIN=(.+)/)?.[1] || "example.com"

    yield "🚀 Deploying Web UI stack (includes Kong, host-manager)..."
    await executeOnHost(
      `cd ${workDir} && DOMAIN=${domain} docker stack deploy --detach=true -c compose.yaml swarm-config`,
    )
    yield "✓ Stack deployed (Kong, Redis, Web UI, host-manager)"

    yield "⏳ Waiting for services to initialize..."
    await executeOnHost("sleep 5")

    yield "🔄 Updating services with new images..."
    try {
      await executeOnHost(
        "docker service update --image swarm-config-ui:latest --force swarm-config_ui 2>/dev/null || true",
      )
      await executeOnHost(
        "docker service update --image host-manager:latest --force swarm-config_host-manager 2>/dev/null || true",
      )
    } catch {
      // Services might not exist yet
    }

    yield "⚙️  Regenerating Kong configuration..."
    try {
      await executeOnHost(`cd ${workDir} && npx tsx src/generate-kong-config.ts`)
      yield "⏳ Waiting for Kong to be ready before reloading..."
      await executeOnHost(`cd ${workDir} && npx tsx src/reload-kong.ts`)
      yield "✓ Kong configuration reloaded"
    } catch {
      yield "⚠️  Kong reload skipped (Kong may still be starting)"
      yield "  You can reload manually later: npm run kong:reload"
    }

    yield `✓ Web UI deployed at: https://config.${domain}`

    // Clean up old setup container if exists
    yield "🔍 Checking for host-manager-setup container..."
    const setupContainer = await executeOnHost("docker ps -a --filter name=host-manager-setup -q")

    if (setupContainer.stdout.trim()) {
      yield "🗑️  Removing old host-manager-setup container..."
      await executeOnHost("docker stop host-manager-setup 2>/dev/null || true")
      await executeOnHost("docker rm host-manager-setup")
      yield "✅ Setup container removed, now using swarm-config_host-manager service"
    }

    return { success: true }
  },
})
