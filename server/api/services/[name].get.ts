import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { parseServiceConfig } from "../../utils/parseService"
import { getSwarmConfig } from "../../../src/config"

export default defineEventHandler(async event => {
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const workspaceBase = process.env.WORKSPACE_BASE || "/var/apps"
    const projectDir = join(workspaceBase, name)
    const filePath = join(projectDir, "service.ts")

    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, message: `Service '${name}' not found` })
    }

    const content = readFileSync(filePath, "utf-8")
    // No more example files in project directories

    // Try to parse the service configuration
    const parsed = parseServiceConfig(content)
    const config = getSwarmConfig()

    return { 
      name, 
      content, 
      path: filePath,
      parsed,  // Will be null for special cases like acme.ts
      isStructured: parsed !== null,
      domain: config.DOMAIN
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    console.error("Error reading service:", error)
    throw createError({ statusCode: 500, message: "Failed to read service configuration" })
  }
})
