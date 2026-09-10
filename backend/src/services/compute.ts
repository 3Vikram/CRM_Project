import type {
  ComputedInvoice,
  ComputedLine,
  InvoiceDraft,
  TaxType,
} from '@crm/shared'
import { findEntity } from '../config/entities.js'
import { amountInWords } from './numberToWords.js'

export interface ComputeError {
  status: number
  message: string
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Per-line description built from make/model like the reference invoices. */
function describeLine(line: InvoiceDraft['lines'][number]): string {
  const make = line.make?.trim()
  const model = line.model?.trim()
  return make && model ? `${make} ${model}` : make || model || 'Rental'
}

/** Compute the per-line taxable value = amount − discount (discount before tax). */
export function lineTaxableValue(line: InvoiceDraft['lines'][number]): number {
  const discount = line.discount ?? 0
  return Math.max(0, round2(line.amount - discount))
}

/**
 * Auto-suggest a tax type by comparing seller state to buyer state.
 * Same state → CGST_SGST, different state → IGST. NONE reserved for
 * `gstApplicable=false`. Used by the frontend to pre-fill the toggle.
 */
export function suggestTaxType(
  sellerStateCode: string | undefined,
  buyerStateCode: string | undefined,
  gstApplicable: boolean,
): TaxType {
  if (!gstApplicable) return 'NONE'
  if (!sellerStateCode || !buyerStateCode) return 'CGST_SGST'
  return sellerStateCode === buyerStateCode ? 'CGST_SGST' : 'IGST'
}

/**
 * The heart of the backend: turn a validated `InvoiceDraft` into a fully
 * resolved `ComputedInvoice`. All tax, totals, round-off and words live here,
 * so the frontend preview never computes math itself.
 *
 * Stateful `mixedCompany` detection is wired in ISSUE-05; here we honour the
 * draft's tax type and rate.
 */
export function computeInvoice(draft: InvoiceDraft): ComputedInvoice {
  const sellerEntity = findEntity(draft.sellerId)
  if (!sellerEntity) {
    throw { status: 400, message: `Unknown seller: ${draft.sellerId}` } as ComputeError
  }

  const consignee = draft.consignee ?? draft.buyer
  const invoiceLines = groupConfigurationLines(draft.lines)

  // Mixed COMPANY guard — one GSTIN cannot bill another entity's rentals.
  const companyKeys = new Set(
    invoiceLines.map((l) => (l.company ?? '').toUpperCase()).filter(Boolean),
  )
  if (companyKeys.size > 1) {
    const breakdown = [...companyKeys.entries()].map(([company, _i]) => ({
      company,
      count: invoiceLines.filter((l) => (l.company ?? '').toUpperCase() === company).length,
    }))
    return {
      seller: entityToSeller(sellerEntity),
      buyer: draft.buyer,
      consignee,
      hsn: draft.hsn,
      lines: invoiceLines.map((line) => ({
        rowRef: line.rowRef,
        description: describeLine(line),
        hsn: draft.hsn,
        quantity: line.quantity,
        rate: line.price,
        taxableValue: lineTaxableValue(line),
        amount: line.amount,
        discount: line.discount,
        isReturned: line.isReturned,
        subLines: displayMembers(line).map((m) => ({
          serial: m.serial,
          model: m.model,
          configuration: m.configuration,
          amount: m.amount,
          from: m.from,
          to: m.to,
          isReturned: m.isReturned,
        })),
      })),
      taxableTotal: 0,
      totalTax: 0,
      grandTotal: 0,
      roundedGrandTotal: 0,
      amountInWords: amountInWords(0),
      taxInWords: amountInWords(0),
      placeOfSupply: draft.buyer.stateCode,
      taxType: 'NONE',
      suggestedTaxType: 'NONE',
      mixedCompany: true,
      mixedCompanyWarning:
        'The dropped rows contain mixed COMPANY values. Split into two invoices before generating.',
      companyBreakdown: breakdown,
    } as ComputedInvoice
  }

  const computedLines: ComputedLine[] = invoiceLines.map((line) => {
    const taxable = lineTaxableValue(line)
    return {
      rowRef: line.rowRef,
      description: describeLine(line),
      hsn: draft.hsn,
      quantity: line.quantity,
      rate: line.price,
      taxableValue: taxable,
      amount: line.amount,
      discount: line.discount,
      isReturned: line.isReturned,
      subLines: displayMembers(line).map((m) => ({
        serial: m.serial,
        model: m.model,
        configuration: m.configuration,
        amount: m.amount,
        from: m.from,
        to: m.to,
        isReturned: m.isReturned,
      })),
    }
  })

  const taxableTotal = round2(
    computedLines.reduce((sum, l) => sum + l.taxableValue, 0),
  )

  const effectiveTaxType: TaxType =
    draft.gstApplicable && draft.taxType !== 'NONE' ? draft.taxType : 'NONE'

  let cgst: ComputedInvoice['cgst']
  let sgst: ComputedInvoice['sgst']
  let igst: ComputedInvoice['igst']

  let totalTax = 0
  if (effectiveTaxType === 'CGST_SGST') {
    const half = round2((draft.gstRate / 2 / 100) * taxableTotal)
    cgst = { label: 'OUTPUT CGST', rate: round2(draft.gstRate / 2), amount: half }
    sgst = { label: 'OUTPUT SGST', rate: round2(draft.gstRate / 2), amount: half }
    totalTax = round2(half * 2)
  } else if (effectiveTaxType === 'IGST') {
    const full = round2((draft.gstRate / 100) * taxableTotal)
    igst = { label: 'OUTPUT IGST', rate: draft.gstRate, amount: full }
    totalTax = full
  }

  const grandTotal = round2(taxableTotal + totalTax)

  let roundOff: ComputedInvoice['roundOff']
  let roundedGrandTotal = grandTotal
  if (draft.roundOff) {
    const rounded = Math.round(grandTotal)
    const diff = round2(rounded - grandTotal)
    roundedGrandTotal = rounded
    const sign = diff >= 0 ? '+' : '-'
    roundOff = {
      difference: diff,
      label: `Rounded Off ${sign}${Math.abs(diff).toFixed(2)}`,
    }
  }

  // Resolve footer blocks from the seller preset when the draft leaves
  // them blank. The show/hide toggles determine which keys are emitted at
  // all — when off, the field is omitted entirely from resolvedFooter.
  const monthLabel = billingMonthLabel(draft.billingMonth.from, draft.billingMonth.to)
  const sellerName = sellerEntity.shortName ?? sellerEntity.name
  const remarks =
    draft.footer.remarks && draft.footer.remarks.trim()
      ? draft.footer.remarks
      : (sellerEntity.remarksTemplate ?? '').replace('{month}', monthLabel).replace('{seller}', sellerName)
  const declaration =
    draft.footer.declaration && draft.footer.declaration.trim()
      ? draft.footer.declaration
      : sellerEntity.declaration
  const terms =
    draft.footer.terms && draft.footer.terms.trim()
      ? draft.footer.terms
      : sellerEntity.terms

  const resolvedFooter: NonNullable<ComputedInvoice['resolvedFooter']> = {}
  if (draft.toggles.showRemarks && remarks) resolvedFooter.remarks = remarks
  if (draft.toggles.showDeclaration && declaration) resolvedFooter.declaration = declaration
  if (draft.toggles.showTc && terms) resolvedFooter.terms = terms
  if (draft.toggles.showBank && sellerEntity.bank) resolvedFooter.bank = sellerEntity.bank

  return {
    seller: entityToSeller(sellerEntity),
    buyer: draft.buyer,
    consignee,
    hsn: draft.hsn,
    lines: computedLines,
    taxableTotal,
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    roundOff,
    roundedGrandTotal,
    amountInWords: amountInWords(roundedGrandTotal),
    taxInWords: amountInWords(totalTax),
    placeOfSupply: draft.buyer.stateCode,
    taxType: effectiveTaxType,
    suggestedTaxType: suggestTaxType(sellerEntity.stateCode, draft.buyer.stateCode, draft.gstApplicable),
    resolvedFooter: Object.keys(resolvedFooter).length > 0 ? resolvedFooter : undefined,
  }
}

/** Every computed invoice line must carry printable device detail. Grouped
 * drafts use their member records; old flat drafts get an equivalent member
 * synthesized from their own make/model/configuration/serial fields. */
function displayMembers(line: InvoiceDraft['lines'][number]) {
  if (line.members?.length) return line.members
  return [{
    rowRef: line.rowRef,
    make: line.make,
    model: line.model,
    serial: Array.isArray(line.serial) ? line.serial.join('/') : line.serial,
    configuration: line.configuration,
    price: line.price,
    amount: line.amount,
    discount: line.discount,
    months: line.months,
    company: line.company,
    from: line.from,
    to: line.to,
    isReturned: line.isReturned,
  }]
}

function groupConfigurationLines(lines: InvoiceDraft['lines']): InvoiceDraft['lines'] {
  // A legacy grouped line remains intact: older drafts may deliberately hold
  // more than one configuration in its serial-member list.
  const flat = lines.filter((line) => !line.members?.length)
  const alreadyGrouped = lines.filter((line) => line.members?.length)
  const groups = new Map<string, typeof flat>()
  for (const line of flat) {
    const config = line.configuration.trim().replace(/\s+/g, ' ').toLowerCase()
    const key = `${(line.company ?? '').trim().toLowerCase()}|${line.make.trim().toLowerCase()}|${line.model.trim().toLowerCase()}|${config}|${line.price}`
    const group = groups.get(key) ?? []
    group.push(line)
    groups.set(key, group)
  }
  const freshlyGrouped = [...groups.values()].map((members) => {
    const first = members[0]
    const amount = round2(members.reduce((sum, line) => sum + line.amount, 0))
    const discount = round2(members.reduce((sum, line) => sum + (line.discount ?? 0), 0))
    return {
      ...first, serial: members.map((line) => String(line.serial)),
      quantity: members.length === 1 ? first.quantity : members.length,
      amount, discount: discount || undefined, isReturned: members.some((line) => line.isReturned),
      members: members.map((line) => ({ rowRef: line.rowRef, make: line.make, model: line.model,
        serial: String(line.serial), configuration: line.configuration, price: line.price, amount: line.amount,
        discount: line.discount, months: line.months, company: line.company, from: line.from, to: line.to,
        isReturned: line.isReturned })),
    }
  })
  return [...alreadyGrouped, ...freshlyGrouped]
}

/** "Jun 2026 / Jul 2026" label spanning the billing month range. */
function billingMonthLabel(from: string, to: string): string {
  const a = new Date(from + 'T00:00:00Z')
  const b = new Date(to + 'T00:00:00Z')
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return ''
  const fmt = (d: Date) =>
    d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const s = fmt(a)
  return s === fmt(b) ? s : `${s} / ${fmt(b)}`
}

function entityToSeller(entity: ReturnType<typeof findEntity>) {
  const e = entity!
  return {
    id: e.id,
    name: e.name,
    legalName: e.legalName,
    address: e.address,
    stateName: e.stateName,
    stateCode: e.stateCode,
    gstin: e.gstin,
    pan: e.pan,
    email: e.email,
    contact: e.contact,
    msme: e.msme,
    cin: e.cin,
    bank: e.bank,
    declaration: e.declaration,
    terms: e.terms,
    remarksTemplate: e.remarksTemplate,
    invoicePrefix: e.invoicePrefix,
  }
}
