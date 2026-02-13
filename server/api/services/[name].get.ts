import { readFileSync } from "fs"
import { findKongConfigByName, findComposeConfigByName } from "../../utils/findConfigFiles"
import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  await requireAuth(event)

  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const config = useRuntimeConfig()
    const kongPath = findKongConfigByName(name)

    if (!kongPath) {
      throw createError({ statusCode: 404, message: `Service '${name}' not found` })
    }

    const kongContent = readFileSync(kongPath, "utf-8")
    const composePath = findComposeConfigByName(name)
    const composeContent = composePath ? readFileSync(composePath, "utf-8") : ""

    return {
      name,
      domain: config.domain,
      kong: {
        content: kongContent,
        path: kongPath,
      },
      compose: {
        content: composeContent,
        path: composePath || "",
      },
    }
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) {
      throw error
    }
    console.error("Error reading service:", error)
    throw createError({ statusCode: 500, message: "Failed to read service configuration" })
  }
})
