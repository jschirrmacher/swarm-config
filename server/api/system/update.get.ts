import { requireAuth } from "~/server/utils/auth"
import { executeOnHostStreaming } from "~/server/utils/hostManager"

export default defineEventHandler(async event => {
  if (process.platform !== "linux") {
    throw createError({
      statusCode: 400,
      message: "System updates are only available on Linux servers",
    })
  }

  await requireAuth(event)

  try {
    console.log(`[${new Date().toISOString()}] System update request initiated`)

    setResponseHeader(event, "Content-Type", "text/event-stream")
    setResponseHeader(event, "Cache-Control", "no-cache")
    setResponseHeader(event, "Connection", "keep-alive")

    await executeOnHostStreaming(
      event.node.res,
      `
      cd /var/apps/swarm-config
      git pull origin main
      npx tsx scripts/setup.sh
    `,
    )

    event.node.res.end()
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] System update failed:`, error)

    if (error.statusCode === 401 || error.statusCode === 403) {
      throw createError({
        statusCode: 500,
        message: "Authentication with host-manager failed",
      })
    }

    throw createError({
      statusCode: 500,
      message: "System update failed",
      data: error.message || String(error),
    })
  }
})
