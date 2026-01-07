import { execSync } from "child_process"
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs"
import { randomBytes } from "crypto"
import { tmpdir } from "os"
import { join } from "path"

/**
 * Generate a random challenge for SSH key authentication
 */
export function generateChallenge(): string {
  return randomBytes(32).toString("base64")
}

/**
 * Get authorized keys for a user
 */
export function getUserAuthorizedKeys(username: string): string[] {
  // Try multiple possible locations
  const possiblePaths = [
    `/home/${username}/.ssh/authorized_keys`, // Linux standard
    `/Users/${username}/.ssh/authorized_keys`, // macOS
    `/root/.ssh/authorized_keys`, // Development fallback
  ]

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log(`[SSH Auth] Found authorized_keys at: ${path}`)
      const content = readFileSync(path, "utf-8")
      const keys = content
        .split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#"))

      // Filter keys that match the username (if not using fallback)
      if (path.includes(username)) {
        return keys
      } else {
        // For fallback (root's keys), try to match by username in key comment
        const matchingKeys = keys.filter(
          line =>
            line.toLowerCase().includes(`@${username}`) ||
            line.toLowerCase().includes(` ${username}@`) ||
            line.toLowerCase().endsWith(` ${username}`),
        )
        if (matchingKeys.length > 0) {
          console.log(
            `[SSH Auth] Found ${matchingKeys.length} matching keys for ${username} in ${path}`,
          )
          return matchingKeys
        }
      }
    }
  }

  console.log(`[SSH Auth] No authorized_keys found for user: ${username}`)
  return []
}

/**
 * Verify SSH signature against user's authorized keys
 * @param username The username to verify
 * @param challenge The challenge string that was signed
 * @param signature The SSH signature (output from ssh-keygen -Y sign)
 * @returns true if signature is valid
 */
export function verifySshSignature(
  username: string,
  challenge: string,
  signature: string,
): boolean {
  const authorizedKeys = getUserAuthorizedKeys(username)

  console.log(`[SSH Auth] Verifying signature for user: ${username}`)
  console.log(`[SSH Auth] Found ${authorizedKeys.length} authorized keys`)

  if (authorizedKeys.length === 0) {
    console.log(`[SSH Auth] No authorized keys found for user: ${username}`)
    return false
  }

  // Create temporary directory for verification files
  const tempDir = join(tmpdir(), `ssh-verify-${Date.now()}-${randomBytes(8).toString("hex")}`)
  mkdirSync(tempDir, { recursive: true })

  console.log(`[SSH Auth] Using temp dir: ${tempDir}`)

  try {
    // Write challenge to file
    const challengeFile = join(tempDir, "challenge")
    writeFileSync(challengeFile, challenge)
    console.log(`[SSH Auth] Challenge written to: ${challengeFile}`)

    // Write signature to file
    const signatureFile = join(tempDir, "signature.sig")
    writeFileSync(signatureFile, signature)
    console.log(`[SSH Auth] Signature written to: ${signatureFile}`)
    console.log(`[SSH Auth] Signature length: ${signature.length} bytes`)

    // Create allowed_signers file with user's public keys
    const allowedSignersFile = join(tempDir, "allowed_signers")
    const allowedSignersContent = authorizedKeys.map(key => `${username} ${key}`).join("\n")
    writeFileSync(allowedSignersFile, allowedSignersContent + "\n")
    console.log(`[SSH Auth] Allowed signers written to: ${allowedSignersFile}`)

    // Verify signature using ssh-keygen
    const cmd = `ssh-keygen -Y verify -f "${allowedSignersFile}" -I "${username}" -n login -s "${signatureFile}" < "${challengeFile}"`
    console.log(`[SSH Auth] Running command: ${cmd}`)

    try {
      const output = execSync(cmd, { stdio: "pipe", encoding: "utf-8" })
      console.log(`[SSH Auth] ✓ Signature verification succeeded`)
      console.log(`[SSH Auth] Output: ${output}`)
      return true
    } catch (error: any) {
      console.error(`[SSH Auth] ✗ Signature verification failed`)
      console.error(`[SSH Auth] Error: ${error.message}`)
      if (error.stderr) {
        console.error(`[SSH Auth] stderr: ${error.stderr.toString()}`)
      }
      if (error.stdout) {
        console.error(`[SSH Auth] stdout: ${error.stdout.toString()}`)
      }
      return false
    }
  } finally {
    // Cleanup temporary files
    try {
      unlinkSync(join(tempDir, "challenge"))
      unlinkSync(join(tempDir, "signature.sig"))
      unlinkSync(join(tempDir, "allowed_signers"))
      unlinkSync(tempDir)
    } catch (error) {
      console.log(`[SSH Auth] Cleanup error (non-fatal): ${error}`)
    }
  }
}

/**
 * Check if user exists on the system
 */
export function userExists(username: string): boolean {
  try {
    execSync(`id ${username}`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}
