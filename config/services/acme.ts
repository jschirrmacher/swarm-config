import { getDomains } from "../../src/DomainRegister.js"

// ACME service adds Kong configuration for all hostnames to use TLS (https protocol)
// This is required for SSL/TLS certificate management
// This is a special dummy service that handles ACME challenges for Let's Encrypt

export default {
  get() {
    return {
      name: "acme-dummy",
      url: "http://127.0.0.1:65535",
      routes: [
        {
          name: "acme-dummy",
          protocols: ["http"],
          paths: ["/.well-known/acme-challenge"],
          hosts: getDomains(),
          preserve_host: true,
          strip_path: false,
          https_redirect_status_code: 302,
        },
      ],
      plugins: [],
    }
  },
}
