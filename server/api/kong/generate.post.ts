import { generateKongConfig } from "~/server/utils/kongConfig"

export default defineEventHandler(async () => {
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
