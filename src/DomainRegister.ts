const domains = new Set<string>()

export function registerDomain(name: string) {
  domains.add(name)
}

export function getDomains() {
  return [...domains]
}

export function clearDomains() {
  domains.clear()
}
