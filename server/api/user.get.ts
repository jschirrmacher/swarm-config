export default defineEventHandler(async event => {
  const { requireAuth } = await import("~/server/utils/auth")

  // Require JWT authentication (or use OS user in development)
  const username = await requireAuth(event)

  return {
    username,
  }
})
