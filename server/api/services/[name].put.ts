import { writeFileSync, existsSync } from "fs"
import { join } from "path"
import { generateServiceCode } from "../../utils/generateService"

export default defineEventHandler(async event => {
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const body = await readBody(event)
    const servicesDir = join(process.cwd(), "config", "services")
    const filePath = join(servicesDir, `${name}.ts`)

    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, message: `Service '${name}' not found` })
    }

    let contentToSave: string

    // Check if we're saving structured data or raw content
    if (body.parsed) {
      // Generate TypeScript code from structured data
      contentToSave = generateServiceCode(name, body.parsed)
    } else if (body.content) {
      // Save raw content as-is
      contentToSave = body.content
    } else {
      throw createError({ statusCode: 400, message: "No content or parsed data provided" })
    }

    // Write the file
    writeFileSync(filePath, contentToSave, "utf-8")

    return { success: true, message: "Service configuration saved successfully" }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    console.error("Error saving service:", error)
    throw createError({ statusCode: 500, message: "Failed to save service configuration" })
  }
})
