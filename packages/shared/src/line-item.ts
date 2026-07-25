import { z } from 'zod'

/**
 * A single candidate invoice line, derived from one Excel row
 * (or grouped from several rows sharing make+model+price).
 *
 * `serial` is `string[]` when the line aggregates multiple units (grouped);
 * `string` for a single unit. `configuration` is display-only and never
 * part of the grouping key. `amount` is editable and defaults to `price * 1`
 * (one month) or a prorated value for returned units.
 *
 * `months` is display-only audit context (never drives the amount).
 * `company` carries the source `COMPANY` column (SYNOV / 3VIKRAM); it is used
 * by ISSUE-05 for seller auto-selection and mixed-company detection. The
 * privacy-sensitive PERSON / COURIER / CONTACT NO columns are never carried.
 */
export const LineItemSchema = z.object({
  rowRef: z.number(),
  make: z.string(),
  model: z.string(),
  serial: z.union([z.string(), z.array(z.string())]),
  configuration: z.string(),
  price: z.number(),
  quantity: z.number().int().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  isReturned: z.boolean(),
  amount: z.number(),
  discount: z.number().optional(),
  months: z.number().optional(),
  company: z.string().optional(),
})
export type LineItem = z.infer<typeof LineItemSchema>