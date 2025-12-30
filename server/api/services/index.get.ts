import { readdirSync, readFileSync } from "fs"
import { join } from "path"

interface ServiceConfig {
  name: string
  url?: string
  routes?: Array<{
    name: string
    hosts?: string[]
    paths?: string[]
    preserve_host?: boolean
    strip_path?: boolean
    protocols?: string[]
  }>
  plugins?: Array<{ name: string; config?: Record<string, unknown> }>
}

export default defineEventHandler(async () => {
  try {
    const servicesDir = join(process.cwd(), "config", "services")
    const files = readdirSync(servicesDir).filter(
      file => file.endsWith(".ts") && !file.endsWith(".example"),
    )

    const services = files.map(file => {
      const name = file.replace(".ts", "")
      const filePath = join(servicesDir, file)
      const content = readFileSync(filePath, "utf-8")

      return {
        name,
        file,
        hasExample: files.includes(file.replace(".ts", ".ts.example")),
      }
    })

    return services
  } catch (error) {
    console.error("Error reading services:", error)
    throw createError({ statusCode: 500, message: "Failed to read services" })
  }
})
