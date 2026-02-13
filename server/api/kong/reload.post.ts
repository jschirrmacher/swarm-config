import { requireAuth } from "~/server/utils/auth"
import { exec } from "node:child_process"
import { promisify } from "node:util"

const execAsync = promisify(exec)

export default defineEventHandler(async event => {
  await requireAuth(event)

  try {
    const { stdout: containerName } = await execAsync(
      'docker ps --format "{{.Names}}" | grep _kong.1',
    )
    const name = containerName.trim()

    if (!name) {
      throw new Error("Kong container not found")
    }

    await execAsync(`docker exec ${name} kong config parse /config/kong.yaml`)
    await execAsync(`docker exec ${name} kong reload`)

    return { success: true, message: "Kong configuration reloaded successfully" }
  } catch (error) {
    console.error("Failed to reload Kong:", error)
    throw createError({
      statusCode: 500,
      message: "Failed to reload Kong configuration",
    })
  }
})
