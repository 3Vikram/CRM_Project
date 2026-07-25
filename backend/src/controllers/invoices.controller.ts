import type { Request, Response, NextFunction } from 'express'
import { InvoiceDraftSchema } from '@crm/shared'
import { computeInvoice, type ComputeError } from '../services/compute.js'

export function computeInvoiceHandler(req: Request, res: Response, next: NextFunction) {
  const parsed = InvoiceDraftSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid invoice draft',
      issues: parsed.error.issues,
    })
    return
  }
  try {
    const result = computeInvoice(parsed.data)
    res.json(result)
  } catch (err) {
    const e = err as ComputeError
    if (e && typeof e.status === 'number') {
      res.status(e.status).json({ error: e.message })
      return
    }
    next(err)
  }
}