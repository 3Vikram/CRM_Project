import { z } from 'zod'

/**
 * A single candidate invoice line, derived from one Excel row
 * (or grouped from several rows sharing make+model+price).
 *
 * `serial` is `string[]` when the line aggregates multiple units (grouped);
 * `string` for a single unit. `configuration` is display-only and never
 * part of the grouping key. `amount` is editable and defaults to `price * 1`
 * (one month) or a prorated value for returned units.
 */
export const LineItemSchema = z.object({
  /** Source Excel SL. NO. (first row of a group). */
  rowRef: z.number(),
  make: z.string(),
  model: z.string(),
  serial: z.union([z.string(), z.array(z.string())]),
  configuration: z.string(),
  /** Monthly rate; a component of the grouping key. */
  price: z.number(),
  /** 1 when flat, N when grouped. */
  quantity: z.number().int().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
  isReturned: z.boolean(),
  amount: z.number(),
  discount: z.number().optional(),
})
export type LineItem = z.infer<typeof LineItemSchema>