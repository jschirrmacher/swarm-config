export default defineEventHandler(async event => {
  const { getCurrentUser } = await import("~/server/utils/gitRepo")

  const username = await getCurrentUser(event)

  return {
    username,
  }
})
