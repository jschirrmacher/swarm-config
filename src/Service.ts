import { getDomains, registerDomain } from "./DomainRegister.js"
import { createPlugin, Plugin, PluginFactory } from "./Plugin.js"

interface Route {
  name: string
  hosts: string[]
  paths: string[]
  preserve_host: boolean
  strip_path: boolean
  https_redirect_status_code: number
  protocols: string[]
}

type RouteOptions = Partial<Route>

const defaultRouteOptions: RouteOptions = {
  preserve_host: true,
  strip_path: false,
  https_redirect_status_code: 302,
  protocols: ["https"],
}

type RouteFactory = {
  get(): Route
}

function createService(
  name: string,
  url: string,
  routeFactories: RouteFactory[],
  pluginFactories?: PluginFactory[],
): ServiceFactory {
  return {
    get() {
      const routes = routeFactories.map(route => route.get())
      const plugins = pluginFactories?.map(plugin => plugin.get()) || []
      return { name, url, routes, plugins }
    },
  }
}

type ServiceFactory = {
  get(): {
    name: string
    url: string
    routes: Route[]
    plugins: Plugin[]
  }
}

function createRoute(name: string, options?: RouteOptions, pluginFactories?: PluginFactory[]) {
  options?.hosts?.forEach(registerDomain)

  return {
    get() {
      const plugins = pluginFactories?.map(plugin => plugin.get())
      return { ...defaultRouteOptions, name, ...options, plugins } as Route
    },
  }
}

export function acmeService(): ServiceFactory {
  const route = {
    get() {
      return {
        ...defaultRouteOptions,
        name: "acme-dummy",
        protocols: ["http"],
        paths: ["/.well-known/acme-challenge"],
        hosts: getDomains(),
      } as Route
    },
  }

  return createService("acme-dummy", "http://127.0.0.1:65535", [route])
}

export function createStack(stack: string) {
  const services = [] as ServiceFactory[]

  return {
    addService(service: string, port: number) {
      const name = stack + "_" + service
      const url = "http://" + name + ":" + port
      const routes = [] as RouteFactory[]
      const plugins = [] as PluginFactory[]

      const result = {
        addRoute(host: string, options?: RouteOptions) {
          options = { ...options, hosts: (options?.hosts || []).concat(host) }
          routes.push(createRoute(name, options))
          return result
        },

        addRedirection(host: string, dest: string, options?: RouteOptions) {
          const access = [`kong.response.exit(301,'Page moved - redirecting to ${dest}/',{['Location']='${dest}' .. kong.request.get_path_with_query()})`]
          const preFunction = createPlugin("pre-function", { access })
          options = {
            ...options,
            hosts: (options?.hosts || []).concat(host),
            https_redirect_status_code: 301,
          }
          const routeName = `${stack}_${host.replaceAll(".", "-")}_redirect`
          const route = createRoute(routeName, options, [preFunction])
          routes.push(route)
          return result
        },

        addPlugin(name: string, config?: Record<string, unknown>) {
          plugins.push(createPlugin(name, config))
          return result
        },

        get() {
          return createService(name, url, routes, plugins).get()
        },
      }

      services.push(result)

      return result
    },

    get() {
      return services.map(service => service.get())
    },
  }
}
