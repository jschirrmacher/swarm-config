import { execAsync, commandExists, type CheckResult } from "../bootstrap-helpers.ts"

export default async function checkGlusterFS(): Promise<CheckResult> {
  const exists = await commandExists("gluster")
  return {
    name: "GlusterFS (optional)",
    passed: true, // Always pass - this is optional
    message: exists
      ? "GlusterFS is installed"
      : "GlusterFS is not installed (optional, needed for multi-node clusters). See docs/MULTI-NODE-SETUP.md for details.",
    fix: exists
      ? undefined
      : async () => {
          console.log("  Installing GlusterFS...")
          await execAsync("sudo apt update && sudo apt install -y glusterfs-server")
          await execAsync("sudo systemctl enable glusterd && sudo systemctl start glusterd")
          console.log(
            "  ℹ️  GlusterFS installed. See docs/MULTI-NODE-SETUP.md for cluster configuration.",
          )
        },
  }
}
