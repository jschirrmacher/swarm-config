import { acmeService, createStack } from "./src/Service.js"
import { createPortainerStack } from "./src/PortainerStack.js"
import { createMonitoringStack } from "./src/MonitoringStack.js"
import {
  createAcmePlugin,
  createPlugin,
  createPrometheusPlugin,
  createRedisStorage,
} from "./src/Plugin.js"
import type { Consumer } from "./src/Consumer.js"

export const consumers: Consumer[] = [
  { username: "joachim", consumerName: "joachim", password: "this-is-not-my-password" },
]

export const plugins = [
  createAcmePlugin("tech@example.com", [createRedisStorage()]), // to use TLS (https protocol)
  createPrometheusPlugin(), // create prometheus metrics for api gateway accesses
  createPlugin("request-size-limiting"), // limit size of requests
  createPlugin("bot-detection"), // detect and reject bots
]

export const services = [
  acmeService(), // Adds Kong configuration for all hostnames in use to use TLS (https protocol)

  createPortainerStack("portainer", "portainer.example.com"), // to configure the docker / k8s cluster

  createMonitoringStack("monitoring", "example.com"), // creates grafana.example.com and prometheus.example.com

  createStack("func").addService("node", 3000).addRoute("func.example.com"), // a small node.js service

  createStack("my-small-application") // a frontend with backend
    .addService("node", 8080)
    .addRoute("my-small-application.example.com")
    .addRoute("my-small-application.example.com", {
      paths: ["/api"], // listens on /api path
      strip_path: true, // removed the /api prefix in the path
      name: "my-small-application-api", // as a second route, it needs a non-default route name
    }),

  createStack("nginx")
    .addService("nginx", 80)
    .addRoute("static.example.com") // serve some static assets (e.g. a static web site or images)
    .addRedirection("example.com", "https://www.example.com") // a redirection to the www. version
    .addRedirection("other.example.com", "https://static.example.com"), // another redirection

  createStack("owncloud").addService("owncloud", 8080).addRoute("files.example.com"), // an owncloud installation
]
