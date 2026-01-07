#!/usr/bin/env node
import { runStep } from "../lib/step.js"
import { exec } from "../lib/docker.js"
import { existsSync, writeFileSync, readFileSync, openSync, closeSync } from "fs"
import { createInterface } from "readline"
import { ReadStream, WriteStream } from "tty"

/**
 * Prompt user for input using /dev/tty for pipe compatibility
 */
function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve, reject) => {
    let ttyFd: number

    try {
      ttyFd = openSync("/dev/tty", "r+")
    } catch (error) {
      reject(new Error("No TTY available"))
      return
    }

    const input = new ReadStream(ttyFd)
    const output = new WriteStream(ttyFd)

    if (hidden) {
      // Password input with masking
      input.setRawMode(true)
      output.write(question)

      let password = ""

      const onData = (char: Buffer) => {
        const c = char.toString("utf8")

        switch (c) {
          case "\n":
          case "\r":
          case "\u0004": // Ctrl+D
            input.setRawMode(false)
            input.removeListener("data", onData)
            output.write("\n")
            closeSync(ttyFd)
            resolve(password)
            break
          case "\u0003": // Ctrl+C
            closeSync(ttyFd)
            process.exit(1)
            break
          case "\u007f": // Backspace
            if (password.length > 0) {
              password = password.slice(0, -1)
              output.write("\b \b")
            }
            break
          default:
            password += c
            output.write("*")
        }
      }

      input.on("data", onData)
    } else {
      // Normal input
      const rl = createInterface({
        input,
        output,
      })

      rl.question(question, answer => {
        rl.close()
        closeSync(ttyFd)
        resolve(answer.trim())
      })
    }
  })
}

await runStep("06.7-configure-email", "Configuring email settings...", async () => {
  const msmtpConfigPath = "/etc/msmtprc"

  // Check if msmtp is already configured
  if (existsSync(msmtpConfigPath)) {
    const config = readFileSync(msmtpConfigPath, "utf-8")
    const hostMatch = config.match(/^host\s+(.+)$/m)
    const portMatch = config.match(/^port\s+(.+)$/m)
    const userMatch = config.match(/^user\s+(.+)$/m)
    const fromMatch = config.match(/^from\s+(.+)$/m)

    console.log("  ✅ Email is already configured via msmtp")
    if (hostMatch?.[1]) console.log(`     SMTP Host: ${hostMatch[1]}`)
    if (portMatch?.[1]) console.log(`     SMTP Port: ${portMatch[1]}`)
    if (userMatch?.[1]) console.log(`     SMTP User: ${userMatch[1]}`)
    if (fromMatch?.[1]) console.log(`     From Address: ${fromMatch[1]}`)
    return
  }

  // Check if /dev/tty is available for interactive input
  if (!existsSync("/dev/tty")) {
    console.log("  ⏭️  No terminal available: Skipping email configuration")
    console.log("  ℹ️  Configure SMTP settings via the web interface (coming soon)")
    return
  }

  console.log("\n  📧 Email Configuration with msmtp")
  console.log("  ----------------------------------")
  console.log("  This will install msmtp and configure it as a sendmail replacement.")
  console.log("  Applications can send emails via localhost/sendmail.\n")

  const smtpHost = await prompt("  SMTP Host (e.g., smtp.gmail.com): ")
  if (!smtpHost) {
    console.log("  ⚠️  Email configuration skipped")
    return
  }

  const smtpPort = await prompt("  SMTP Port (e.g., 587 for TLS, 465 for SSL): ")
  const smtpUser = await prompt("  SMTP Username/Email: ")
  const smtpPassword = await prompt("  SMTP Password: ", true)
  const smtpFrom = (await prompt(`  From Address (default: ${smtpUser}): `)) || smtpUser
  const useTls = (await prompt("  Use TLS? (Y/n): ")).toLowerCase() !== "n"

  // Install msmtp
  console.log("\n  📦 Installing msmtp...")
  exec("apt update")
  exec("apt install -y msmtp msmtp-mta")

  // Create msmtp configuration
  const msmtpConfig = `# msmtp configuration for swarm-config
defaults
auth           on
tls            ${useTls ? "on" : "off"}
tls_trust_file /etc/ssl/certs/ca-certificates.crt
logfile        /var/log/msmtp.log

# SMTP account configuration
account        default
host           ${smtpHost}
port           ${smtpPort}
from           ${smtpFrom}
user           ${smtpUser}
password       ${smtpPassword}
`

  writeFileSync(msmtpConfigPath, msmtpConfig, { mode: 0o600 })
  console.log("  ✅ msmtp configuration written to /etc/msmtprc")

  // Create log file with proper permissions
  exec("touch /var/log/msmtp.log")
  exec("chmod 666 /var/log/msmtp.log")

  // Create symlink for sendmail compatibility
  if (!existsSync("/usr/sbin/sendmail")) {
    exec("ln -s /usr/bin/msmtp /usr/sbin/sendmail")
    console.log("  ✅ Created sendmail symlink")
  }

  console.log("\n  ✅ Email configuration completed")
  console.log(`     SMTP Host: ${smtpHost}`)
  console.log(`     SMTP Port: ${smtpPort}`)
  console.log(`     From Address: ${smtpFrom}`)
  console.log("\n  Applications can now send emails via localhost or /usr/sbin/sendmail")
})
