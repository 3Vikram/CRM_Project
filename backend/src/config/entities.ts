import type { Entity } from '@crm/shared'

/**
 * Seller legal-entity presets — the single source of truth for the invoice
 * header, footer defaults, bank block, and the suggested invoice-number prefix.
 * Served by `GET /api/entities`.
 *
 * Both sellers are Karnataka-registered (state code 29), so CGST/SGST vs IGST
 * is driven by the buyer's state.
 */
export const ENTITIES: Entity[] = [
  {
    id: '3vikram',
    name: '3Vikram Technologies',
    shortName: '3VIKRAM',
    legalName: '3Vikram Technologies - 2025-26',
    address: 'No.1/5 Santosh Complex Basavanagudi, Near Armugam Circle, Bengaluru - 560004',
    stateCode: '29',
    stateName: 'Karnataka',
    gstin: '29APPPK7534R1ZR',
    pan: 'APPPK7534R',
    email: 'pavan@3vikram.in',
    contact: '9901574446,9740997444',
    msme: 'UDYAM-KR-03-0029793',
    cin: undefined,
    invoicePrefix: '3VT/',
    eInvoiceDefault: true,
    bank: {
      holderName: '3VIKRAM TECHNOLOGIES',
      bankName: 'HDFC BANK',
      accountNo: '04462000005256',
      branch: 'BASAVANAGUDI, GANDHI BAZAAR',
      ifsc: 'HDFC0000446',
    },
    declaration:
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    terms:
      '1. Interest @24% p.a will be charged on delayed Payments, outstanding payment made only in the form of Demand Draft/ RTGS.\n2. Goods once sold cannot be returned or Exchanged short shipment of materials should be bought to our notice immediately.\n3. Our company is under MSME category. kindly release the payment with in the due date. MSME:UDYAM-KR-03-0029793.',
    remarksTemplate: 'Being Rental Invoice Raised for the Month of {month} ({seller})',
  },
  {
    id: 'synov',
    name: 'SYNOV IT Services Pvt Ltd',
    shortName: 'KVAS',
    legalName: 'SYNOV IT SERVICES PRIVATE LIMITED - (23-24)',
    address:
      '91 Springboard Business Hub Pvt Ltd, Gopala Krishna Complex, No. 45/3, Residency Road, MG Road, Bengaluru-560025',
    stateCode: '29',
    stateName: 'Karnataka',
    gstin: '29ABICS1686C1Z4',
    pan: 'ABICS1686C',
    email: 'Pk.k@synov.in/sales@synov.in',
    contact: '',
    msme: undefined,
    cin: 'U72900KA2022PTC159475',
    invoicePrefix: 'SISPL/',
    eInvoiceDefault: false,
    bank: {
      holderName: 'SYNOV IT SERVICES PRIVATE LIMITED',
      bankName: 'ICICI BANK',
      accountNo: '000000000000000',
      branch: 'BENGALURU',
      ifsc: 'ICIC0000000',
    },
    declaration:
      'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    terms:
      '1. Interest @24% p.a will be charged on delayed Payments.\n2. Goods once sold cannot be returned or Exchanged. Short shipment of materials should be bought to our notice immediately.',
    remarksTemplate: 'Being Rental Invoice Raised for the Month of {month} ({seller})',
  },
]

export function findEntity(id: string | undefined): Entity | undefined {
  if (!id) return undefined
  return ENTITIES.find((e) => e.id === id || e.shortName === id)
}