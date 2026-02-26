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
    if (isDevMode()) {
      execSync(`docker compose -p ${name} down`, { encoding: 'utf-8' })
    } else {
      execSync(`docker stack rm ${name}`, { encoding: 'utf-8' })
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error stopping service:", error)
    throw createError({ 
      statusCode: 500, 
      message: error.message || "Failed to stop service" 
    })
  }
})
