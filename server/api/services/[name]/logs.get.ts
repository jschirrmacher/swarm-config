import { execSync } from "child_process"
import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const logs = execSync(`docker service logs ${name} --tail 500`, { 
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 10 // 10MB
    })

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
