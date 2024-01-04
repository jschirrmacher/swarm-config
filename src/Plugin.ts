import { getDomains } from "./DomainRegister.js"

export function createPlugin(name: string, config?: Record<string, unknown>) {
  return {
    get() {
      return { name, config }
    },
  }
}

export interface Plugin {
  name: string
  config?: Record<string, unknown>
}

export type PluginFactory = {
  get(): Plugin
}

interface RedisStorage {
  type: "redis"
  host: string
  port: number
}

type Storage = RedisStorage

export function createRedisStorage(host = "redis", port = 6379): RedisStorage {
  return { type: "redis", host, port }
}

export function createAcmePlugin(adminEmail: string, storageConfigs: Storage[] = []) {
  return {
    get() {
      return {
        name: "acme",
        config: {
          account_email: adminEmail,
          tos_accepted: true,
          storage: storageConfigs.map(c => c.type).join(","),
          storage_config: Object.fromEntries(
            storageConfigs.map(({ type, ...rest }) => [type, rest]),
          ),
          domains: getDomains(),
        },
      }
    },
  }
}

export function createPrometheusPlugin() {
  return createPlugin("prometheus", {
    status_code_metrics: true,
    latency_metrics: true,
    bandwidth_metrics: true,
    upstream_health_metrics: true,
  })
}
