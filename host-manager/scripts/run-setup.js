#!/usr/bin/env node

/**
 * Client script to run setup via internal host-manager API
 * This script runs inside a temporary container that shares the network
 * with the host-manager server, avoiding the need for external port exposure
 */

const token = process.env.HOST_MANAGER_TOKEN
if (!token) {
  console.error("❌ HOST_MANAGER_TOKEN environment variable is required")
  process.exit(1)
}

async function runSetup() {
  try {
    const response = await fetch("http://localhost:3001/setup/run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ force: false }),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n").filter(line => line.trim())

      for (const line of lines) {
        try {
          const event = JSON.parse(line)

          switch (event.event) {
            case "step-start":
              console.log("")
              console.log(`🔄 ${event.data.name}`)
              break
            case "log":
              if (event.data.message) {
                console.log(`  ${event.data.message}`)
              }
              break
            case "step-skip":
              console.log("  ⏭️  Already completed")
              break
            case "step-complete":
              console.log("  ✅ Success")
              break
            case "step-error":
              console.log(`  ❌ Error: ${event.data.error}`)
              process.exit(1)
              break
            case "complete":
              console.log("")
              console.log(`✅ All setup steps completed successfully`)
              console.log(
                `   ${event.data.succeeded} succeeded, ${event.data.skipped} skipped, ${event.data.failed} failed`,
              )
              break
          }
        } catch (e) {
          // Ignore JSON parse errors for incomplete chunks
        }
      }
    }
  } catch (error) {
    console.error(`❌ Setup failed: ${error.message}`)
    process.exit(1)
  }
}

runSetup()
