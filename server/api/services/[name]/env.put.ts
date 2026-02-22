import { requireAuth } from "~/server/utils/auth"
import { readProjectConfig, writeProjectJson } from "~/server/utils/workspace"

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

  const projectData = readProjectConfig(name, auth.username)
  
  if (!projectData) {
    throw createError({ statusCode: 404, message: "Project not found" })
  }

  if (projectData.owner !== auth.username) {
    throw createError({ statusCode: 403, message: "Only the owner can update environment variables" })
  }

  projectData.env = body.env
  writeProjectJson(name, projectData)

  return { success: true }
})
