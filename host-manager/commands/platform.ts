import { defineCommand } from "../lib/defineCommand.js"
import os from "os"

/**
 * GET /system/platform
 * Returns the host system platform information
 */
export default defineCommand(
  "Get system platform information",
  "GET",
  "/system/platform",
  async () => {
    return {
      platform: os.platform(),
      arch: os.arch(),
      type: os.type(),
    }
  },
)
