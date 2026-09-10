import { Router } from 'express'
import { getEntities } from '../controllers/entities.controller.js'
import { computeInvoiceHandler } from '../controllers/invoices.controller.js'
import { accountingRouter } from '../accounting/routes.js'

export const apiRouter = Router()

apiRouter.get('/entities', getEntities)
apiRouter.post('/invoices/compute', computeInvoiceHandler)
apiRouter.use('/accounting', accountingRouter)

// v2 stubs — reserved for future persistence; not implemented in v1.
apiRouter.post('/invoices', (_req, res) => {
  res.status(501).json({ error: 'Not implemented in v1' })
})
apiRouter.get('/invoices', (_req, res) => {
  res.status(501).json({ error: 'Not implemented in v1' })
})
