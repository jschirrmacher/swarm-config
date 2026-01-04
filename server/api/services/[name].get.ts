import { readFileSync, existsSync } from "fs"
import { join } from "path"
import { parseServiceConfig } from "../../utils/parseService"

export default defineEventHandler(async event => {
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const config = useRuntimeConfig()
    const workspaceBase = config.workspaceBase
    const projectDir = join(workspaceBase, name)

    // Check for kong.yaml in .swarm/ first, then in project root
    const possiblePaths = [join(projectDir, ".swarm", "kong.yaml"), join(projectDir, "kong.yaml")]

    const filePath = possiblePaths.find(path => existsSync(path))

    if (!filePath) {
      throw createError({ statusCode: 404, message: `Service '${name}' not found` })
    }

    const content = readFileSync(filePath, "utf-8")

    return { name, content, path: filePath, domain: config.domain }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    console.error("Error reading service:", error)
    throw createError({ statusCode: 500, message: "Failed to read service configuration" })
  }
})
