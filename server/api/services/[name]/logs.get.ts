import { execSync } from "child_process"
import { requireAuth } from "~/server/utils/auth"
import { isDevMode } from "~/server/utils/workspace"

export default defineEventHandler(async event => {
  await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    let logs = ''

    if (isDevMode()) {
      // Development: Docker Compose
      logs = execSync(`docker compose -p ${name} logs --tail 500`, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10 // 10MB
      })
    } else {
      // Production: Docker Swarm - get logs from all services in the stack
      const services = execSync(`docker stack services ${name} --format "{{.Name}}"`, {
        encoding: 'utf-8'
      }).trim().split('\n').filter(Boolean)

      if (services.length === 0) {
        throw new Error(`No services found in stack ${name}`)
      }

      // Get logs from all services in the stack
      const allLogs = services.map(service => {
        try {
          return `=== ${service} ===\n` + execSync(`docker service logs ${service} --tail 200`, {
            encoding: 'utf-8',
            maxBuffer: 1024 * 1024 * 10
          })
        } catch (err) {
          return `=== ${service} ===\nError: ${err}\n`
        }
      })

      logs = allLogs.join('\n\n')
    }

    return {
      logs
    }
  } catch (error: any) {
    console.error("Error reading logs:", error)
    throw createError({ 
      statusCode: 500, 
      message: error.message || "Failed to read service logs" 
    })
  }
})
