export default defineEventHandler(async () => {
  try {
    const response = await fetch(
      `${process.env.HOST_MANAGER_URL || "http://localhost:3001"}/system/platform`,
      {
        headers: {
          Authorization: `Bearer ${process.env.HOST_MANAGER_TOKEN}`,
        },
      },
    )

    if (response.ok) {
      return response.json()
    }
  } catch {
    // Host-manager not available, fall back to local platform
  }

  return {
    platform: process.platform,
  }
})
