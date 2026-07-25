import { z } from 'zod'

/** A party block (Buyer/Bill-to or Consignee/Ship-to). */
export const PartySchema = z.object({
  name: z.string(),
  address: z.string(),
  gstin: z.string(),
  stateName: z.string(),
  stateCode: z.string(),
})
export type Party = z.infer<typeof PartySchema>