import { execAsync, runCommand, type CheckResult } from "../bootstrap-helpers.ts"

export default async function checkKongNetwork(): Promise<CheckResult> {
  try {
    const { stdout } = await runCommand(
      "docker network ls --filter name=kong-net --format '{{.Name}}'",
    )
    const exists = stdout.trim() === "kong-net"
    return {
      name: "Kong Network",
      passed: exists,
      message: exists ? "kong-net network exists" : "kong-net network does not exist",
      fix: async () => {
        console.log("  Creating kong-net network...")
        await execAsync("docker network create --scope=swarm --attachable -d overlay kong-net")
      },
    }
  } catch {
    return {
      name: "Kong Network",
      passed: false,
      message: "Cannot check Docker networks",
    }
  }
}
