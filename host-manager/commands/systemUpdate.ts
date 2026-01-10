import { defineStreamingCommand } from "../lib/defineCommand.js"
import { executeOnHostStreaming } from "../lib/execute.js"

export default defineStreamingCommand(
  "Trigger system update via git pull and setup.sh",
  "POST",
  "/system/update",
  async function* () {
    yield* executeOnHostStreaming(`
      cd /var/apps/swarm-config
      git pull origin main
      npx tsx scripts/setup.sh
    `)
  },
)
