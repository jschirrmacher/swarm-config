import jwt from "jsonwebtoken"
import { verifySshSignature } from "~/server/utils/sshKeyAuth"
import { getChallenge, removeChallenge } from "~/server/utils/challengeStore"

export default defineEventHandler(async event => {
  const body = await readBody(event)
  const { username, signature } = body

  console.log(`[Auth Verify] Request from username: ${username}`)
  console.log(`[Auth Verify] Signature length: ${signature?.length || 0} bytes`)

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
    console.log(`[Auth Verify] No challenge found for user: ${username}`)
    throw createError({
      statusCode: 401,
      message: "No active challenge found. Please request a new challenge.",
    })
  }

  console.log(
    `[Auth Verify] Challenge found, expires: ${new Date(challengeData.expires).toISOString()}`,
  )

  // Check if challenge expired
  if (challengeData.expires < Date.now()) {
    removeChallenge(username)
    console.log(`[Auth Verify] Challenge expired for user: ${username}`)
    throw createError({
      statusCode: 401,
      message: "Challenge expired. Please request a new challenge.",
    })
  }

  // Verify signature
  console.log(`[Auth Verify] Verifying signature...`)
  const isValid = verifySshSignature(username, challengeData.challenge, signature)

  // Remove used challenge
  removeChallenge(username)

  if (!isValid) {
    console.log(`[Auth Verify] ✗ Signature verification failed for user: ${username}`)
    throw createError({
      statusCode: 401,
      message: "Invalid signature. Authentication failed.",
    })
  }

  console.log(`[Auth Verify] ✓ Signature verified successfully for user: ${username}`)

  // Generate JWT token
  const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production"
  const token = jwt.sign({ username }, secret, { expiresIn: "7d" })

  return {
    token,
    username,
    expiresIn: "7d",
  }
})
