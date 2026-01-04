<template>
  <div class="app">
    <NuxtPage />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg-primary: #f5f5f5;
  --bg-secondary: #ffffff;
  --text-primary: #333;
  --text-secondary: #666;
  --border-color: #e0e0e0;
  --shadow: rgba(0, 0, 0, 0.1);
  --accent: #667eea;
  --accent-hover: #5568d3;
}

.dark {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --border-color: #404040;
  --shadow: rgba(0, 0, 0, 0.3);
  --accent: #7c8fef;
  --accent-hover: #8fa1f5;
}

html,
body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.6;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
