import { useRef, useState } from 'react'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { COMPANY_PROFILE } from '@/lib/companyProfile'

type ChallanItem = {
  productName?: string
  description?: string
  hsnSac?: string
  serialNumber?: string
  serialNumbers?: string[]
  quantity?: number
  uom?: string
  unitPrice?: number
  tax?: number
  taxAmount?: number
  gstAmount?: number
  lineTotal?: number
}

type PartyDetails = {
  name?: string
  customerName?: string
  contactPerson?: string
  address?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  pincode?: string
  gstNumber?: string
  gstNo?: string
  email?: string
}

export type DeliveryChallanDocument = {
  id: string
  challanNumber?: string
  createdAt?: string
  dcDate?: string
  deliveryNote?: string
  customerName?: string
  contactPerson?: string
  customer?: PartyDetails
  contact?: PartyDetails
  billTo?: PartyDetails
  dcFor?: PartyDetails
  opfNo?: string
  poNo?: string
  poDate?: string
  despatchDocumentNo?: string
  dcType?: string
  dispatchedThrough?: string
  destination?: string
  returnDate?: string
  status?: string
  accountManager?: string
  termsAndConditions?: string | string[]
  termsConditions?: string | string[]
  terms?: string | string[]
  signatureRequired?: boolean
  currency?: string
  items?: ChallanItem[]
}

interface DeliveryChallanPreviewProps {
  challan: DeliveryChallanDocument
  onBack: () => void
}

const optionalValue = (value: string | undefined) => value?.trim() || '—'

const formatDate = (value?: string) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

const money = (value: number) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)

const wordsBelowHundred = (number: number): string => {
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ]
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  if (number < 20) return ones[number]
  return `${tens[Math.floor(number / 10)]}${number % 10 ? ` ${ones[number % 10]}` : ''}`
}

const numberToWords = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) return '—'
  const number = Math.floor(value)
  if (number === 0) return 'Zero'
  const groups: Array<[number, string]> = [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
    [100, 'Hundred'],
  ]
  let remainder = number
  const parts: string[] = []
  for (const [size, label] of groups) {
    const count = Math.floor(remainder / size)
    if (count) {
      parts.push(`${count < 100 ? wordsBelowHundred(count) : numberToWords(count)} ${label}`)
      remainder %= size
    }
  }
  if (remainder) parts.push(wordsBelowHundred(remainder))
  return parts.join(' ')
}

const DELIVERY_CHALLAN_TERMS = [
  'Any damage / loss / Dent / Scratches etc or any other problem caused to the above product will be will be billed to partner. Synov IT Services Pvt Ltd decision on these matters will be final.',
  'Courier charges will be borne by the client if the pickup and delivery location is outside Bengaluru.',
  'Demo material must be returned within the agreed demo duration, which shall not exceed 7 days. Any delay beyond this period, without written approval from Synov IT Services Pvt Ltd, will result in the material being billed at its DC value. The partner agrees to make payment for the same within 7 days from the date of invoice.',
]

function PartyBox({ title, party }: { title: string; party: PartyDetails }) {
  const address = [
    party.address,
    party.addressLine1,
    party.addressLine2,
    party.city,
    party.state,
    party.pincode,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ')

  return (
    <section className="dc-party">
      <h2>{title}</h2>
      <strong>{optionalValue(party.name || party.customerName)}</strong>
      {party.contactPerson && <div>Contact: {party.contactPerson}</div>}
      <div>{optionalValue(address || undefined)}</div>
      <div>GST No: {optionalValue(party.gstNumber || party.gstNo)}</div>
      <div>Email: {optionalValue(party.email)}</div>
    </section>
  )
}

export default function DeliveryChallanPreview({ challan, onBack }: DeliveryChallanPreviewProps) {
  const documentRef = useRef<HTMLElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const items = challan.items || []
  const subtotal = items.reduce(
    (total, item) => total + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  )
  const gstTotal = items.reduce((total, item) => {
    const lineSubtotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    return total + (Number(item.gstAmount ?? item.taxAmount) || lineSubtotal * (Number(item.tax) || 0) / 100)
  }, 0)
  const grandTotal = items.reduce((total, item) => {
    const computed = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    const tax = Number(item.gstAmount ?? item.taxAmount) || computed * (Number(item.tax) || 0) / 100
    return total + (Number(item.lineTotal) || computed + tax)
  }, 0)
  const customer = challan.customer || {}
  const billTo = challan.billTo || customer
  const dcFor = challan.dcFor || challan.contact || {
    name: challan.customerName,
    customerName: challan.customerName,
    contactPerson: challan.contactPerson,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    pincode: customer.pincode,
    gstNumber: customer.gstNumber || customer.gstNo,
    email: customer.email,
  }
  const dcNumber = optionalValue(challan.challanNumber)
  const filename = `${(challan.challanNumber || 'delivery-challan').replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`

  const downloadPdf = async () => {
    if (!documentRef.current) return
    setIsDownloading(true)
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(documentRef.current)
        .save()
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="dc-preview-root">
      <style>{`
        .dc-preview-root { color: #17212b; }
        .dc-preview-document { width: 100%; max-width: 190mm; margin: 0 auto; background: #fff; color: #17212b; font-family: Arial, Helvetica, sans-serif; font-size: 10px; }
        .dc-preview-document *, .dc-preview-document *::before, .dc-preview-document *::after { box-sizing: border-box; }
        .dc-preview-document .dc-header { position: relative; min-height: 78px; padding: 8px 76px 12px; text-align: center; border-bottom: 1px solid #333; }
        .dc-preview-document .dc-header img { position: absolute; top: 5px; right: 3px; width: 64px; height: 64px; object-fit: contain; }
        .dc-preview-document .dc-title { margin: 0 0 8px; font-size: 18px; font-weight: 700; }
        .dc-preview-document .dc-company { font-size: 10px; font-weight: 700; }
        .dc-preview-document .dc-company-address { margin: 3px auto; max-width: 490px; line-height: 1.35; }
        .dc-preview-document .dc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #333; border-left: 1px solid #333; margin-top: 10px; }
        .dc-preview-document .dc-field { min-height: 37px; padding: 5px 6px; border-right: 1px solid #333; border-bottom: 1px solid #333; overflow-wrap: anywhere; }
        .dc-preview-document .dc-field b { display: block; margin-bottom: 3px; font-size: 8px; text-transform: uppercase; }
        .dc-preview-document .dc-parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); margin-top: 10px; }
        .dc-preview-document .dc-party { min-height: 102px; padding: 7px; border: 1px solid #333; border-right: 0; line-height: 1.45; overflow-wrap: anywhere; }
        .dc-preview-document .dc-party:last-child { border-right: 1px solid #333; }
        .dc-preview-document .dc-party h2 { margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #777; font-size: 9px; }
        .dc-preview-document .dc-items { width: 100%; margin-top: 10px; border-collapse: collapse; table-layout: fixed; }
        .dc-preview-document .dc-items th, .dc-preview-document .dc-items td { padding: 2px 3px !important; border: 1px solid #333; font-size: 10px !important; overflow-wrap: anywhere; text-align: left; vertical-align: top; height: auto !important; min-height: 0 !important; }
        .dc-preview-document .dc-items th { background: #f1f1f1; font-size: 9px !important; line-height: 1.2; }
        .dc-preview-document .dc-items td { line-height: 1.25; }
        .dc-preview-document .dc-items tbody tr { height: auto !important; min-height: 0 !important; }
        .dc-preview-document .dc-items tbody td:nth-child(2), .dc-preview-document .dc-items tbody td:nth-child(3), .dc-preview-document .dc-items tbody td:nth-child(4) { padding: 2px 3px !important; font-size: 10px !important; line-height: 1.25 !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
        .dc-preview-document .dc-items th:nth-child(1) { width: 5%; }
        .dc-preview-document .dc-items th:nth-child(2) { width: 17%; }
        .dc-preview-document .dc-items th:nth-child(3) { width: 19%; }
        .dc-preview-document .dc-items th:nth-child(4) { width: 13%; }
        .dc-preview-document .dc-items th:nth-child(5) { width: 6%; }
        .dc-preview-document .dc-items th:nth-child(6) { width: 10%; }
        .dc-preview-document .dc-items th:nth-child(7) { width: 10%; }
        .dc-preview-document .dc-items th:nth-child(8) { width: 9%; }
        .dc-preview-document .dc-items th:nth-child(9) { width: 11%; }
        .dc-preview-document .dc-totals { width: 48%; margin: 0 0 0 auto; border-collapse: collapse; }
        .dc-preview-document .dc-totals th, .dc-preview-document .dc-totals td { padding: 4px 7px; border: 1px solid #333; font-size: 10px !important; text-align: right; }
        .dc-preview-document .dc-amount-words, .dc-preview-document .dc-terms { margin-top: 9px; padding: 7px; border: 1px solid #333; }
        .dc-preview-document .dc-terms { overflow-wrap: anywhere; line-height: 1.4; }
        .dc-preview-document .dc-terms li { break-inside: avoid; page-break-inside: avoid; margin-bottom: 3px; }
        .dc-preview-document .dc-delivery-note { margin-top: 9px; padding: 7px; border: 1px solid #333; font-weight: 700; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.4; }
        .dc-preview-document .dc-section-title { margin: 0 0 5px; font-size: 9px; font-weight: 700; }
        .dc-preview-document .dc-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 22px; page-break-inside: avoid; }
        .dc-preview-document .dc-signature { min-height: 75px; padding: 7px; border: 1px solid #333; display: flex; flex-direction: column; justify-content: space-between; }
        .dc-preview-document .dc-generated { margin: 10px 0 0; padding-bottom: 5mm; text-align: center; font-size: 8px; }
        .dc-preview-document .dc-keep { page-break-inside: auto; break-inside: auto; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body, #root { width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .dc-preview-root, .dc-preview-root * { visibility: visible !important; }
          .dc-preview-controls { display: none !important; }
          .dc-preview-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .dc-preview-document { width: 210mm !important; max-width: 210mm !important; margin: 0 auto !important; padding: 10mm !important; border: 0 !important; box-shadow: none !important; }
          .dc-preview-document .dc-items thead { display: table-header-group; }
          .dc-preview-document .dc-items tbody tr { height: auto !important; min-height: 0 !important; break-inside: auto; page-break-inside: auto; }
          .dc-preview-document .dc-party { page-break-inside: avoid; }
        }
      `}</style>

      <div className="dc-preview-controls mb-5 flex flex-wrap items-center justify-between gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#F7F5F0]"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Delivery Challans
        </button>
        <div className="flex gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[#D9D3C7] bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-[#F7F5F0]"
            onClick={() => window.print()}
            type="button"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-xl bg-[#06283D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0B3A53] disabled:opacity-60"
            disabled={isDownloading}
            onClick={() => void downloadPdf()}
            type="button"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
          </button>
        </div>
      </div>

      <article className="dc-preview-document border border-[#333] bg-white p-4 shadow-sm" ref={documentRef}>
        <header className="dc-header">
          <img alt="Synov IT Services logo" src={COMPANY_PROFILE.logoUrl} />
          <h1 className="dc-title">Delivery Challan</h1>
          <div className="dc-company">{COMPANY_PROFILE.name}</div>
          <div className="dc-company-address">{COMPANY_PROFILE.address}</div>
          <div>GST No: {COMPANY_PROFILE.gstNumber}</div>
        </header>

        <section className="dc-grid" aria-label="Delivery Challan information">
          {[
            ['DC No', dcNumber],
            ['DC Date', formatDate(challan.dcDate || challan.createdAt)],
            ['PO No', optionalValue(challan.poNo)],
            ['OPF No', optionalValue(challan.opfNo)],
            ['PO Date', formatDate(challan.poDate)],
            ['DC Type', optionalValue(challan.dcType)],
            ['Despatched Through', optionalValue(challan.dispatchedThrough)],
            ['Destination', optionalValue(challan.destination)],
          ].map(([label, value]) => (
            <div className="dc-field" key={label}>
              <b>{label}</b>
              <span>{value}</span>
            </div>
          ))}
        </section>

        <div className="dc-parties">
          <PartyBox
            title="DC By"
            party={{ name: COMPANY_PROFILE.name, address: COMPANY_PROFILE.address, gstNumber: COMPANY_PROFILE.gstNumber }}
          />
          <PartyBox
            title="Bill To"
            party={{
              ...billTo,
              name: billTo.name || challan.customerName,
              customerName: billTo.customerName || challan.customerName,
            }}
          />
          <PartyBox
            title="DC For"
            party={{
              ...dcFor,
              name: dcFor.name || challan.customerName,
              contactPerson: dcFor.contactPerson || challan.contactPerson,
            }}
          />
        </div>

        <table className="dc-items">
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Product</th>
              <th>Description</th>
              <th>Serial No.</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th>Sub Total</th>
              <th>GST</th>
              <th>Total Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const quantity = Number(item.quantity) || 0
              const unitPrice = Number(item.unitPrice) || 0
              const lineSubtotal = quantity * unitPrice
              const lineGst = Number(item.gstAmount ?? item.taxAmount) || lineSubtotal * (Number(item.tax) || 0) / 100
              const lineTotal = Number(item.lineTotal) || lineSubtotal + lineGst
              return (
                <tr key={`${item.productName || 'item'}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{optionalValue(item.productName)}</td>
                  <td>{optionalValue(item.description)}</td>
                  <td>{optionalValue([...(item.serialNumbers || []), item.serialNumber].filter(Boolean).join(', '))}</td>
                  <td>{quantity || '—'}</td>
                  <td>{money(unitPrice)}</td>
                  <td>{money(lineSubtotal)}</td>
                  <td>{money(lineGst)}</td>
                  <td>{money(lineTotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="dc-keep">
          <table className="dc-totals">
            <tbody>
              <tr><th>Subtotal</th><td>{challan.currency || 'INR'} {money(subtotal)}</td></tr>
              <tr><th>GST</th><td>{challan.currency || 'INR'} {money(gstTotal)}</td></tr>
              <tr><th>Grand Total</th><td><strong>{challan.currency || 'INR'} {money(grandTotal)}</strong></td></tr>
            </tbody>
          </table>
          <section className="dc-amount-words">
            <h2 className="dc-section-title">Amount in Words</h2>
            <div>{numberToWords(grandTotal)} Rupees Only</div>
          </section>
          {challan.deliveryNote?.trim() && (
            <section className="dc-delivery-note">
              <strong>Delivery Note:</strong>{' '}
              <span>{challan.deliveryNote}</span>
            </section>
          )}
          <section className="dc-terms">
            <h2 className="dc-section-title">Terms &amp; Conditions</h2>
            <ol className="m-0 list-decimal space-y-1 pl-4">
              {DELIVERY_CHALLAN_TERMS.map((term) => <li key={term}>{term}</li>)}
            </ol>
          </section>
          <div className="dc-signatures">
            <section className="dc-signature">
              <strong>For {COMPANY_PROFILE.name}</strong>
              {challan.signatureRequired && <span>Authorized Signature</span>}
            </section>
            <section className="dc-signature">
              <strong>For {optionalValue(challan.customerName)}</strong>
              {challan.signatureRequired && <span>Customer Signature</span>}
            </section>
          </div>
          <p className="dc-generated">This is an electronically generated document, signature not required.</p>
        </div>
      </article>
    </div>
  )
}
