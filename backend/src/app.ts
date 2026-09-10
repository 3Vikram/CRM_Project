import express from 'express'
import { apiRouter } from './routes/index.js'
import { ZodError } from 'zod'
import { AccountingError } from './accounting/errors.js'
import { DatabaseUnavailableError } from './db.js'

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
      if (err instanceof ZodError) return res.status(400).json({ error: 'Invalid request', issues: err.issues })
      if (err instanceof AccountingError || err instanceof DatabaseUnavailableError) return res.status(err.status).json({ error: err.message, code: 'code' in err ? err.code : 'DATABASE_UNAVAILABLE' })
      if (typeof err === 'object' && err !== null && 'code' in err && err.code === '23505') return res.status(409).json({ error: 'A record with the same unique reference already exists', code: 'CONFLICT' })
      // eslint-disable-next-line no-console
      console.error('Unhandled error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    },
  )

  return app
}
