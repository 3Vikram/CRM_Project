import express from 'express'
import { apiRouter } from './routes/index.js'

export function createApp() {
  const app = express()
  app.use(express.json({ limit: '4mb' }))

  // simple health probe
  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  // primary seam — all deterministic invoice math + entity presets
  app.use('/api', apiRouter)

  // common error handler
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      // eslint-disable-next-line no-console
      console.error('Unhandled error:', err)
      res.status(500).json({ error: 'Internal server error' })
    },
  )

  return app
}