#!/usr/bin/env tsx
/**
 * Semantic Versioning Management Script
 *
 * Usage:
 *   npm run version:bump patch   # 1.0.0 → 1.0.1
 *   npm run version:bump minor   # 1.0.0 → 1.1.0
 *   npm run version:bump major   # 1.0.0 → 2.0.0
 *   npm run version:get          # Shows current version
 *   npm run version:tag          # Creates git tag for current version
 */

import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { execSync } from "node:child_process"
import process from "node:process"

type BumpType = "major" | "minor" | "patch"

interface PackageJson {
  version: string
  [key: string]: unknown
}

const PACKAGE_JSON = join(process.cwd(), "package.json")

function readVersion(): string {
  const pkg: PackageJson = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"))
  return pkg.version
}

function writeVersion(version: string): void {
  const pkg: PackageJson = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8"))
  pkg.version = version
  writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + "\n")
}

function parseVersion(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return [parseInt(match[1]!), parseInt(match[2]!), parseInt(match[3]!)]
}

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(current)

  switch (type) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid bump type: ${type}`)
  }
}

function createGitTag(version: string): void {
  const tag = `v${version}`

  // Check if tag already exists
  try {
    execSync(`git rev-parse ${tag}`, { stdio: "pipe" })
    console.log(`⚠️  Tag ${tag} already exists`)
    return
  } catch {
    // Tag doesn't exist, create it
  }

  // Check if there are uncommitted changes
  const status = execSync("git status --porcelain", { encoding: "utf-8" })
  if (status.trim() !== "") {
    console.error("❌ Cannot create tag: uncommitted changes detected")
    console.error("   Commit or stash your changes first")
    process.exit(1)
  }

  // Create annotated tag
  execSync(`git tag -a ${tag} -m "Release version ${version}"`, {
    stdio: "inherit",
  })
  console.log(`✅ Created git tag: ${tag}`)
  console.log(`   Push with: git push origin ${tag}`)
}

function showVersion(): void {
  const version = readVersion()
  console.log(version)
}

function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (command === "get" || !command) {
    showVersion()
    return
  }

  if (command === "bump") {
    const bumpType = args[1] as BumpType
    if (!["major", "minor", "patch"].includes(bumpType)) {
      console.error("❌ Invalid bump type. Use: major, minor, or patch")
      process.exit(1)
    }

    const currentVersion = readVersion()
    const newVersion = bumpVersion(currentVersion, bumpType)

    writeVersion(newVersion)
    console.log(`✅ Version bumped: ${currentVersion} → ${newVersion}`)
    console.log(`   Don't forget to commit and create a tag:`)
    console.log(`   git add package.json`)
    console.log(`   git commit -m "chore: bump version to ${newVersion}"`)
    console.log(`   npm run version:tag`)
    return
  }

  if (command === "tag") {
    const version = readVersion()
    createGitTag(version)
    return
  }

  console.error(`❌ Unknown command: ${command}`)
  console.error("   Usage: version.ts [get|bump|tag] [major|minor|patch]")
  process.exit(1)
}

main()
