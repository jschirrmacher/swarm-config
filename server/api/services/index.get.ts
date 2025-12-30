import { readdirSync } from "fs"
import { join } from "path"

export default defineEventHandler(async () => {
  try {
    const servicesDir = join(process.cwd(), "config", "services")
    const files = readdirSync(servicesDir).filter(
      file => file.endsWith(".ts") && !file.endsWith(".example"),
    )

    const services = files.map(file => {
      const name = file.replace(".ts", "")
      return { name, file, hasExample: files.includes(file.replace(".ts", ".ts.example")) }
    })

    return services
  } catch (error) {
    console.error("Error reading services:", error)
    throw createError({ statusCode: 500, message: "Failed to read services" })
  }
})
