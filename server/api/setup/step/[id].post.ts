export default defineEventHandler(async event => {
  const stepId = getRouterParam(event, "id")
  const body = await readBody(event)

  const response = await fetch(
    `${process.env.HOST_MANAGER_URL || "http://localhost:3001"}/setup/step/${stepId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HOST_MANAGER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      message: `Failed to run step ${stepId}`,
    })
  }

  return response.json()
})
