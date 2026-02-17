import { readFileSync, writeFileSync, existsSync } from "fs"
import { join } from "path"
import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  const auth = await requireAuth(event)
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  const body = await readBody(event)
  
  if (!body.env || typeof body.env !== 'object') {
    throw createError({ statusCode: 400, message: "Invalid environment data" })
  }

  try {
    const workspaceDir = `/var/apps/${auth.username}/${name}`
    const projectJsonPath = join(workspaceDir, 'project.json')
    
    if (!existsSync(projectJsonPath)) {
      throw createError({ statusCode: 404, message: "Project not found" })
    }

    const projectData = JSON.parse(readFileSync(projectJsonPath, 'utf-8'))
    
    // Only owner can update environment
    if (projectData.owner !== auth.username) {
      throw createError({ statusCode: 403, message: "Only the owner can update environment variables" })
    }

    projectData.env = body.env
    writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2))

    return { success: true }
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error
    }
    console.error("Error updating environment:", error)
    throw createError({ statusCode: 500, message: "Failed to update environment variables" })
  }
})
