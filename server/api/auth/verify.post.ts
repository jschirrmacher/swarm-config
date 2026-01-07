import jwt from "jsonwebtoken"
import { verifySshSignature } from "~/server/utils/sshKeyAuth"
import { getChallenge, removeChallenge } from "~/server/utils/challengeStore"

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const { username, signature } = body

  if (!username || typeof username !== "string") {
    throw createError({
      statusCode: 400,
      message: "Username is required",
    })
  }

  if (!signature || typeof signature !== "string") {
    throw createError({
      statusCode: 400,
      message: "Signature is required",
    })
  }

  // Get stored challenge
  const challengeData = getChallenge(username)
  if (!challengeData) {
    throw createError({
      statusCode: 401,
      message: "No active challenge found. Please request a new challenge.",
    })
  }

  // Check if challenge expired
  if (challengeData.expires < Date.now()) {
    removeChallenge(username)
    throw createError({
      statusCode: 401,
      message: "Challenge expired. Please request a new challenge.",
    })
  }

  // Verify signature
  const isValid = verifySshSignature(username, challengeData.challenge, signature)

  // Remove used challenge
  removeChallenge(username)

  if (!isValid) {
    throw createError({
      statusCode: 401,
      message: "Invalid signature. Authentication failed.",
    })
  }

  // Generate JWT token
  const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
  const token = jwt.sign({ username }, secret, { expiresIn: "7d" })

  return {
    token,
    username,
    expiresIn: "7d",
  }
})
