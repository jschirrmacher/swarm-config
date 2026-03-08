export default defineNitroPlugin(() => {
  process.umask(0o0002)
})
