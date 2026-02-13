import { generateChallenge } from "~/server/utils/sshKeyAuth"
import { storeChallenge } from "~/server/utils/challengeStore"

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const { username } = body

  if (!username || typeof username !== "string") {
    throw createError({
      statusCode: 400,
      message: "Username is required",
    })
  }

  // Validate username format
  if (!/^[a-z][a-z0-9_]*$/.test(username)) {
    throw createError({
      statusCode: 400,
      message: "Invalid username format",
    })
  }

  // Always generate and store challenge, even if user doesn't exist
  // This prevents user enumeration attacks
  const challenge = generateChallenge()
  storeChallenge(username, challenge)

  return {
    username,
    challenge,
    expiresIn: 600, // seconds
  }
})
