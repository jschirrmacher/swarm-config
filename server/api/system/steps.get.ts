import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

export default defineEventHandler(async () => {
  try {
    // Try multiple possible paths (container vs host)
    const possiblePaths = [
      join(process.cwd(), "scripts", "steps"), // Development/Container
      "/var/apps/swarm-config/scripts/steps", // Host system
    ]

    let stepsDir = ""
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        stepsDir = path
        break
      }
    }

    if (!stepsDir) {
      throw new Error("Steps directory not found")
    }

    const stepFiles = readdirSync(stepsDir)
      .filter(file => file.endsWith(".ts"))
      .sort()

    const steps = stepFiles.map(file => {
      const filePath = join(stepsDir, file)
      const content = readFileSync(filePath, "utf-8")

      // Extract step ID and title from runStep() call
      // Pattern: runStep("step-id", "🎨 Title...", ...)
      const match = content.match(/runStep\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/)

      const id = match ? match[1] : file.replace(".ts", "")
      const title = match ? match[2] : file.replace(".ts", "").replace(/^\d+-/, "")

      return {
        id,
        title,
        filename: file,
      }
    })

    return steps
  } catch (error: any) {
    console.error("Failed to load steps:", error)
    throw createError({
      statusCode: 500,
      message: "Failed to load steps",
      data: error?.message || String(error),
    })
  }
})
