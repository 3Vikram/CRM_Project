import { Router } from 'express'
import { InvoiceDraftSchema } from '@crm/shared'
import { getEntities } from '../controllers/entities.controller.js'
import { computeInvoiceHandler } from '../controllers/invoices.controller.js'
import { accountingRouter } from '../accounting/routes.js'
import { database } from '../db.js'
import {
  cancelSalesInvoice, deleteInvoiceDraft, getInvoiceDraft, getSalesInvoice,
  issueSalesInvoice, listSalesInvoices, saveInvoiceDraft,
} from '../accounting/salesInvoices.js'

export const apiRouter = Router()

apiRouter.get('/entities', getEntities)
apiRouter.post('/invoices/compute', computeInvoiceHandler)
apiRouter.use('/accounting', accountingRouter)

// --- issued sale invoices ---------------------------------------------------

apiRouter.get('/invoices', async (req, res, next) => { try {
  const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : undefined
  res.json(await listSalesInvoices(database(), companyId))
} catch (error) { next(error) } })

apiRouter.get('/invoices/:id', async (req, res, next) => { try {
  res.json(await getSalesInvoice(database(), req.params.id))
} catch (error) { next(error) } })

apiRouter.post('/invoices', async (req, res, next) => { try {
  const draft = InvoiceDraftSchema.parse(req.body)
  res.status(201).json(await issueSalesInvoice(database(), draft, req.actor!))
} catch (error) { next(error) } })

apiRouter.post('/invoices/:id/cancel', async (req, res, next) => { try {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined
  res.json(await cancelSalesInvoice(database(), req.params.id, req.actor!, reason))
} catch (error) { next(error) } })

// --- per-user autosaved sale invoice draft ----------------------------------

apiRouter.get('/invoice-draft', async (req, res, next) => { try {
  res.json({ draft: await getInvoiceDraft(database(), req.actor!.id) })
} catch (error) { next(error) } })

apiRouter.put('/invoice-draft', async (req, res, next) => { try {
  await saveInvoiceDraft(database(), req.actor!.id, req.body)
  res.status(204).end()
} catch (error) { next(error) } })

apiRouter.delete('/invoice-draft', async (req, res, next) => { try {
  await deleteInvoiceDraft(database(), req.actor!.id)
  res.status(204).end()
} catch (error) { next(error) } })
