import { writeFileSync } from "fs"
import { join } from "path"
import {
  findKongConfigByName,
  findComposeConfigByName,
  getProjectDir,
} from "../../utils/findConfigFiles"

export default defineEventHandler(async event => {
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const body = await readBody(event)

    // Save kong.yaml if provided
    if (body.kong !== undefined) {
      const kongPath = findKongConfigByName(name)

      if (!kongPath) {
        throw createError({
          statusCode: 404,
          message: `Kong config for service '${name}' not found`,
        })
      }

      writeFileSync(kongPath, body.kong, "utf-8")
    }

    // Save docker-compose.yaml if provided
    if (body.compose !== undefined) {
      const composePath = findComposeConfigByName(name)

      if (!composePath) {
        // If no compose file exists, create one in .swarm/
        const projectDir = getProjectDir(name)
        const newPath = join(projectDir, ".swarm", "docker-compose.yaml")
        writeFileSync(newPath, body.compose, "utf-8")
      } else {
        writeFileSync(composePath, body.compose, "utf-8")
      }
    }

    return { success: true, message: "Service configuration saved successfully" }
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error
    }
    console.error("Error saving service:", error)
    throw createError({ statusCode: 500, message: "Failed to save service configuration" })
  }
})
