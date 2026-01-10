export default defineEventHandler(async event => {
  const response = await fetch(
    `${process.env.HOST_MANAGER_URL || "http://localhost:3001"}/setup/steps`,
    {
      headers: {
        Authorization: `Bearer ${process.env.HOST_MANAGER_TOKEN}`,
      },
    },
  )

  if (!response.ok) {
    throw createError({
      statusCode: response.status,
      message: "Failed to fetch setup steps",
    })
  }

  return response.json()
})
