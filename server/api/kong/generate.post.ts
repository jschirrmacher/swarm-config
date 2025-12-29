import { generateKongConfig } from "~/server/utils/kongConfig"
import { requireAuth } from "~/server/utils/auth"

export default defineEventHandler(async event => {
  // Require JWT authentication (or use OS user in development)
  await requireAuth(event)

  try {
    const config = await generateKongConfig(true) // silent mode

    return {
      success: true,
      message: "Kong configuration generated successfully",
      services: config.services.length,
      plugins: config.plugins.length,
      consumers: config.consumers.length,
    }
  } catch (error) {
    console.error("Failed to generate Kong config:", error)
    throw createError({
      statusCode: 500,
      message: "Failed to generate Kong configuration",
      data: error instanceof Error ? error.message : String(error),
    })
  }
})
