import { readFileSync, existsSync } from "fs"
import { join } from "path"

export default defineEventHandler(async event => {
  const name = getRouterParam(event, "name")

  if (!name) {
    throw createError({ statusCode: 400, message: "Service name is required" })
  }

  try {
    const servicesDir = join(process.cwd(), "config", "services")
    const filePath = join(servicesDir, `${name}.ts`)

    if (!existsSync(filePath)) {
      throw createError({ statusCode: 404, message: `Service '${name}' not found` })
    }

    const content = readFileSync(filePath, "utf-8")
    const examplePath = join(servicesDir, `${name}.ts.example`)
    const hasExample = existsSync(examplePath)

    return { name, content, hasExample, linesOfCode: content.split("\n").length, path: filePath }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    console.error("Error reading service:", error)
    throw createError({ statusCode: 500, message: "Failed to read service configuration" })
  }
})
