import { exec, execSplit } from "./exec"

let swarmActiveCache: boolean | null = null
let servicesCache: Record<string, StackStatus> = {}

type StackStatus = {
  exists: boolean
  running: number
  total: number
  status: "running" | "partial" | "stopped" | "not deployed"
  replicas: string
}

type Service = {
  ID: string
  Image: string
  Name: string
  running: number
  total: number
}

export function isSwarmActive() {
  if (swarmActiveCache === null) {
    try {
      const output = exec('docker info --format "{{.Swarm.LocalNodeState}}"', { timeout: 3000 })
      swarmActiveCache = output === "active"
    } catch {
      swarmActiveCache = false
    }
  }
  return swarmActiveCache
}

function parseSwarmService(line: string): Service {
  const service = JSON.parse(line)
  const match = service.Replicas?.match(/(\d+)\/(\d+)/)
  return {
    ID: service.ID,
    Image: service.Image,
    Name: service.Name,
    running: match ? parseInt(match[1]!, 10) : 0,
    total: match ? parseInt(match[2]!, 10) : 0,
  }
}

function parseComposeService(line: string): Service {
  const service = JSON.parse(line)
  return {
    ID: service.ID,
    Image: service.Image,
    Name: service.Name,
    running: service.State === "running" ? 1 : 0,
    total: 1,
  }
}

function getSwarmStacks() {
  return execSplit('docker stack ls --format "{{.Name}}"').map(stackName => ({
    name: stackName,
    services: execSplit(`docker stack services ${stackName} --format json`).map(parseSwarmService),
  }))
}

function getComposeStacks() {
  const stacks = JSON.parse(exec("docker compose ls --format json")) as { Name: string }[]
  return stacks.map(stack => ({
    name: stack.Name,
    services: execSplit(`docker compose -p ${stack.Name} ps --format json`).map(
      parseComposeService,
    ),
  }))
}

function calculateStackStatus(services: Service[]): StackStatus {
  const totalRunning = services.reduce((sum, s) => sum + s.running, 0)
  const totalReplicas = services.reduce((sum, s) => sum + s.total, 0)
  const status =
    totalRunning === totalReplicas ? "running" : totalRunning > 0 ? "partial" : "stopped"

  return {
    exists: true,
    running: totalRunning,
    total: totalReplicas,
    status,
    replicas: `${totalRunning}/${totalReplicas}`,
  }
}

export function getServices() {
  try {
    const stacks = isSwarmActive() ? getSwarmStacks() : getComposeStacks()
    return Object.fromEntries(
      stacks.map(({ name, services }) => [name, calculateStackStatus(services)]),
    ) as Record<string, StackStatus>
  } catch (error) {
    console.error("Error fetching service info:", error)
    return {}
  }
}

function updateServicesCache() {
  try {
    servicesCache = getServices()
  } catch (error) {
    console.error("Error updating services cache:", error)
  }
  setTimeout(updateServicesCache, 5000)
}

updateServicesCache()

export function getDockerStatus(stackName: string) {
  return (
    servicesCache[stackName] ?? {
      exists: false,
      running: 0,
      total: 0,
      status: "not deployed",
      replicas: "0/0",
    }
  )
}
