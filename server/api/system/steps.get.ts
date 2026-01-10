import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

export default defineEventHandler(async () => {
  try {
    // System update uses the setup steps
    // Get them from the host-manager setup API
    try {
      const response = await fetch(
        `${process.env.HOST_MANAGER_URL || "http://localhost:3001"}/setup/steps`,
        {
          headers: {
            Authorization: `Bearer ${process.env.HOST_MANAGER_TOKEN}`,
          },
        },
      )

      if (response.ok) {
        const data = await response.json()
        // Transform setup steps to system update format
        return (
          data.steps?.map((step: any) => ({
            id: step.id,
            title: step.name,
            description: step.description,
            filename: step.id + ".ts",
            isComplete: step.isComplete,
            status: step.status,
            lastRun: step.lastRun,
            manualOnly: step.manualOnly,
          })) || []
        )
      }
    } catch (error) {
      console.warn("Could not fetch steps from host-manager:", error)
    }

    // Fallback: return empty array for development without host-manager
    return []
  } catch (error: any) {
    console.error("Failed to load steps:", error)
    throw createError({
      statusCode: 500,
      message: "Failed to load steps",
      data: error?.message || String(error),
    })
  }
})
