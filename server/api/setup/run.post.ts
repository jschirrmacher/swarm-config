export default defineEventHandler(async event => {
  const body = await readBody(event)

  const response = await fetch(
    `${process.env.HOST_MANAGER_URL || "http://localhost:3001"}/setup/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HOST_MANAGER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok || !response.body) {
    throw createError({
      statusCode: response.status,
      message: "Failed to start setup",
    })
  }

  setResponseStatus(event, 200)
  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  })

  return sendStream(event, response.body)
})
