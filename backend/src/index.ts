import { createApp } from './app.js'

const PORT = Number(process.env.PORT ?? 4000)

const app = createApp()

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] Accounts API listening on http://localhost:${PORT}`)
})