import { execSync } from 'child_process'
import type { ExecSyncOptions } from 'child_process'

/**
 * Execute a shell command with proper error handling
 * @param command The command to execute
 * @param options Options for command execution
 * @param errorMessage Optional custom error message
 * @returns Command output as string if encoding is set
 */
export function exec(
  command: string,
  options?: ExecSyncOptions & { encoding: BufferEncoding },
  errorMessage?: string
): string
export function exec(
  command: string,
  options?: ExecSyncOptions,
  errorMessage?: string
): Buffer | string
export function exec(
  command: string,
  options: ExecSyncOptions = { stdio: 'inherit' },
  errorMessage?: string
): Buffer | string {
  try {
    return execSync(command, options)
  } catch (error) {
    if (errorMessage) {
      console.error(`❌ ${errorMessage}`)
    }
    throw error
  }
}

/**
 * Execute a docker command
 */
export function docker(args: string, options?: ExecSyncOptions): Buffer | string {
  return exec(`docker ${args}`, options)
}

/**
 * Check if a docker stack exists
 */
export function stackExists(stackName: string): boolean {
  try {
    const stacks = exec('docker stack ls 2>/dev/null', { encoding: 'utf-8' }) as string
    return stacks.includes(`\n${stackName} `)
  } catch (error) {
    return false
  }
}

/**
 * Check if a docker network exists
 */
export function networkExists(networkName: string): boolean {
  try {
    const networks = exec(
      `docker network ls --filter name=${networkName} --format "{{.Name}}"`,
      { encoding: 'utf-8' }
    ) as string
    return networks.trim().split('\n').includes(networkName)
  } catch (error) {
    return false
  }
}

/**
 * Check if a docker image exists
 */
export function imageExists(imageName: string): boolean {
  try {
    const images = exec('docker images', { encoding: 'utf-8' }) as string
    return images.includes(imageName)
  } catch (error) {
    return false
  }
}

/**
 * Wait for a service to be ready
 */
export function waitForService(
  serviceName: string,
  maxRetries: number = 30,
  retryDelay: number = 2
): boolean {
  console.log(`  Waiting for ${serviceName} to be ready...`)
  
  for (let retry = 0; retry < maxRetries; retry++) {
    try {
      const replicas = exec(
        `docker service ls --filter name=${serviceName} --format "{{.Replicas}}"`,
        { encoding: 'utf-8' }
      ) as string

      if (replicas.trim() === '1/1') {
        console.log(`✅ ${serviceName} deployed and running`)
        return true
      }
    } catch (error) {
      // Service not ready yet
    }

    if (retry < maxRetries - 1) {
      console.log(`  ${serviceName} still starting... (${retry + 1}/${maxRetries})`)
      exec(`sleep ${retryDelay}`)
    }
  }

  console.log(`⚠️  ${serviceName} taking longer than expected`)
  console.log(`  Check status: docker service ls | grep ${serviceName}`)
  return false
}
