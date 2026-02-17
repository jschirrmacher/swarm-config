export default defineEventHandler(async event => {
  const { requireAuth } = await import("~/server/utils/auth")

  // Require JWT authentication (or use OS user in development)
  const auth = await requireAuth(event)

  return {
    username: auth.username,
  }
})
