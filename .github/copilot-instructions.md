# GitHub Copilot Instructions

## General Guidelines

- **Never automatically commit or push changes** - Always show changes and wait for explicit user confirmation before running git commands
- When editing files, show the changes clearly and explain what was modified
- **Always check VSCode Problems** after making changes to ensure code compiles without errors

## Project-Specific Context

- This is a Docker Swarm configuration management tool
- The project manages Kong Gateway configurations for multiple applications
- Applications can be in regular directories or symlinked directories under `/var/apps/`
- The codebase uses TypeScript, Nuxt 3, and Docker Swarm

## Code Style

- Use concise, descriptive variable names
- Prefer functional programming patterns where appropriate
- Add comments for complex logic
- Keep functions small and focused

## Vue Component Structure

- **Always use this order in Vue components**: `<script setup>`, `<template>`, `<style>`
- Never use `<style>` before `<template>`
- This ensures consistency across the codebase
