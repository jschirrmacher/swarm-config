/**
 * In-memory store for authentication challenges
 * Shared across all API endpoints
 */

interface ChallengeData {
  challenge: string
  expires: number
}

const challenges = new Map<string, ChallengeData>()

// Cleanup expired challenges every minute
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of challenges.entries()) {
    if (value.expires < now) {
      challenges.delete(key)
    }
  }
}, 60000)

export function storeChallenge(username: string, challenge: string): void {
  const expires = Date.now() + 10 * 60 * 1000 // 10 minutes
  challenges.set(username, { challenge, expires })
}

export function getChallenge(username: string): ChallengeData | undefined {
  return challenges.get(username)
}

export function removeChallenge(username: string): void {
  challenges.delete(username)
}
