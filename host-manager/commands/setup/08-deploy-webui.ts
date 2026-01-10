import { defineSetupCommand } from "../../lib/defineSetupCommand.js"
import { executeOnHost } from "../../lib/execute.js"

export default defineSetupCommand({
  id: "08-deploy-webui",
  name: "Deploy Web UI",
  description: "Build and deploy Swarm Config Web UI",

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
    return { success: true }
  },
})
