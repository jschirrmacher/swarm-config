import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export default defineEventHandler(async () => {
  try {
    // Get Kong container name
    const { stdout: containerList } = await execAsync(
      'docker ps --format "{{.Names}}" | grep _kong.1',
    )
    const containerName = containerList.trim()

    if (!containerName) {
      throw new Error("Kong container not found")
    }

    // Reload Kong configuration
    await execAsync(`docker exec ${containerName} kong reload`)

    return {
      success: true,
      message: "Kong configuration reloaded successfully",
      container: containerName,
    }
  } catch (error) {
    console.error("Failed to reload Kong:", error)
    throw createError({
      statusCode: 500,
      message: "Failed to reload Kong configuration",
      data: error instanceof Error ? error.message : String(error),
    })
  }
})
