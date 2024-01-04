import { createStack } from "./Service.js"

export function createPortainerStack(stackName: string, hostname: string) {
  return createStack(stackName).addService("portainer", 9000).addRoute(hostname)
}
