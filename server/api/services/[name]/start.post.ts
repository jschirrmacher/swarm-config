import { execSync } from "child_process"
import { requireAuth } from "~/server/utils/auth"
import { isDevMode, getWorkspaceDir } from "~/server/utils/workspace"

export default defineEventHandler(async event => {
  const auth = await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    if (isDevMode()) {
      const workspaceDir = getWorkspaceDir(name, auth.username)
      execSync(`docker compose -p ${name} up -d`, { 
        encoding: 'utf-8',
        cwd: workspaceDir
      })
    } else {
      const workspaceDir = getWorkspaceDir(name, auth.username)
      execSync(`docker stack deploy -c ${workspaceDir}/compose.yaml ${name}`, { encoding: 'utf-8' })
    }

    return { success: true }
  } catch (error: any) {
    console.error("Error starting service:", error)
    throw createError({ 
      statusCode: 500, 
      message: error.message || "Failed to start service" 
    })
  }
})
