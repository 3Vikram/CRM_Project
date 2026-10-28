import { useRef, useState } from 'react'
import { ArrowLeft, Building2, Download, IndianRupee, Printer, ReceiptText, Truck, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
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
  area?: string
  city?: string
  state?: string
  pincode?: string
  country?: string
  gstNumber?: string
  gstNo?: string
  email?: string
  shipToSameAsBilling?: boolean
  shipToAddress?: {
    addressLine1?: string
    area?: string
    city?: string
    state?: string
    pincode?: string
    country?: string
  }
}

export type DeliveryChallanDocument = {
  id: string
  challanNumber?: string
  customerId?: string
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

function PartyBox({ title, party, icon }: { title: string; party: PartyDetails; icon: ReactNode }) {
  const address = [
    party.address,
    party.addressLine1,
    party.addressLine2,
    party.area,
    party.city,
    party.state,
    party.pincode,
    party.country,
  ]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(', ')

  return (
    <section className="dc-party">
      <h2>{icon}{title}</h2>
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
  const shipTo = customer.shipToAddress || {}
  const hasShipToAddress = Object.values(shipTo).some((value) => Boolean(value?.trim()))
  const dcForAddress = customer.shipToSameAsBilling === false && hasShipToAddress ? shipTo : customer
  const dcFor = challan.dcFor || {
    ...customer,
    ...dcForAddress,
    contactPerson: customer.contactPerson || challan.contactPerson,
  }
  const dcNumber = optionalValue(challan.challanNumber)
  const filename = `${(challan.challanNumber || 'delivery-challan').replace(/[^a-zA-Z0-9_-]/g, '-')}.pdf`

  const downloadPdf = async () => {
    if (!documentRef.current) return
    setIsDownloading(true)
    const documentElement = documentRef.current
    const previousStyle = documentElement.getAttribute('style')
    try {
      documentElement.style.width = '194mm'
      documentElement.style.maxWidth = 'none'
      documentElement.style.margin = '0'
      documentElement.style.padding = '5mm'
      documentElement.style.border = '0.4mm solid #063B60'
      documentElement.style.boxShadow = 'none'

      const images = Array.from(documentElement.querySelectorAll('img'))
      await Promise.all(images.map(async (image) => {
        if (image.complete) {
          if (image.naturalWidth === 0) throw new Error(`Unable to load Delivery Challan image: ${image.src}`)
          return
        }
        await new Promise<void>((resolve, reject) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => reject(new Error(`Unable to load Delivery Challan image: ${image.src}`)), { once: true })
        })
      }))

      const { default: html2pdf } = await import('html2pdf.js')
      const pdfOptions = {
        margin: 8,
        filename,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', windowWidth: 794 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'] },
      }
      await html2pdf()
        .set(pdfOptions)
        .from(documentRef.current)
        .save()
    } catch (error) {
      console.error('Failed to generate Delivery Challan PDF', error)
      window.alert('Unable to generate the Delivery Challan PDF. Please try again.')
    } finally {
      if (previousStyle === null) documentElement.removeAttribute('style')
      else documentElement.setAttribute('style', previousStyle)
      setIsDownloading(false)
    }
  }

  return (
    <div className="dc-preview-root">
      <style>{`
        .dc-preview-root { color: #17212b; }
        .dc-preview-document { width: 194mm; max-width: 100%; margin: 0 auto; padding: 5mm !important; border: 0.4mm solid #063B60 !important; box-shadow: none !important; background: #fff; color: #17212b; font-family: "Times New Roman", Times, serif; font-size: 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .dc-preview-document *, .dc-preview-document *::before, .dc-preview-document *::after { box-sizing: border-box; }
        .dc-preview-document .dc-brandbar { position: relative; display: flex; align-items: center; justify-content: space-between; min-height: 80px; padding: 8px 16px; overflow: hidden; border-top: 4px solid #079DB5; background: #fff; }
        .dc-preview-document .dc-brandbar::before, .dc-preview-document .dc-brandbar::after { position: absolute; inset: 0 0 0 auto; content: ""; pointer-events: none; }
        .dc-preview-document .dc-brandbar::before { width: 61%; background: #063B60; clip-path: polygon(0 0, 100% 0, 100% 100%, 20% 100%); }
        .dc-preview-document .dc-brandbar::after { width: 48%; background: #079DB5; clip-path: polygon(0 0, 18% 0, 39% 100%, 20% 100%); }
        .dc-preview-document .dc-brand-identity { position: relative; z-index: 1; display: flex; align-items: center; }
        .dc-preview-document .dc-brand-logo { width: 58px; height: 62px; object-fit: contain; }
        .dc-preview-document .dc-brand-wordmark { position: absolute; z-index: 1; top: 50%; right: 18px; display: grid; color: #fff; line-height: 1; text-align: right; transform: translateY(-50%); }
        .dc-preview-document .dc-brand-wordmark strong { font-family: Arial, sans-serif; font-size: 20px; letter-spacing: 0.18em; }
        .dc-preview-document .dc-brand-wordmark span { margin-top: 4px; font-size: 8px; letter-spacing: 0.2em; }
        .dc-preview-document .dc-header { position: relative; min-height: 88px; padding: 11px 0 9px; text-align: center; border-bottom: 2px solid #079DB5; background: #fff; }
        .dc-preview-document .dc-title { margin: 0 0 5px; color: #063B60; font-size: 23px; font-weight: 700; }
        .dc-preview-document .dc-company { font-size: 11px; font-weight: 700; color: #063B60; }
        .dc-preview-document .dc-company-address { margin: 3px auto; line-height: 1.35; }
        .dc-preview-document .dc-header-gst { color: #063B60; font-weight: 700; }
        .dc-preview-document .dc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-top: 8px; border-top: 1px solid #70aabe; border-left: 1px solid #70aabe; background: #fff; }
        .dc-preview-document .dc-field { min-height: 34px; padding: 5px 7px; border-right: 1px solid #70aabe; border-bottom: 1px solid #70aabe; background: #fff; overflow-wrap: anywhere; }
        .dc-preview-document .dc-field b { display: block; margin-bottom: 3px; color: #063B60; font-size: 8px; text-transform: uppercase; }
        .dc-preview-document .dc-parties { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 8px; }
        .dc-preview-document .dc-party { min-width: 0; min-height: 112px; padding: 0 8px 8px; border: 1px solid #70aabe; border-radius: 6px; background: #fff; line-height: 1.4; overflow-wrap: anywhere; }
        .dc-preview-document .dc-party h2 { display: flex; align-items: center; gap: 7px; margin: 0 -8px 7px; padding: 6px 8px; border-radius: 5px 5px 0 0; background: #08748b; color: #fff; font-size: 10px; letter-spacing: 0.03em; text-transform: none; }
        .dc-preview-document .dc-party h2 svg { width: 13px; height: 13px; }
        .dc-preview-document .dc-items { width: 100%; margin-top: 9px; border-collapse: collapse; table-layout: fixed; background: #fff; }
        .dc-preview-document .dc-items th, .dc-preview-document .dc-items td { padding: 5px 4px !important; border: 1px solid #b7cbd4; background: #fff; font-size: 9px !important; overflow-wrap: anywhere; word-break: normal; text-align: left; vertical-align: top; height: auto !important; min-height: 0 !important; }
        .dc-preview-document .dc-items th { background: #063B60; color: #fff; font-size: 8.5px !important; font-weight: 700; line-height: 1.2; }
        .dc-preview-document .dc-items td { line-height: 1.3; }
        .dc-preview-document .dc-items tbody tr { height: auto !important; min-height: 0 !important; }
        .dc-preview-document .dc-items tbody td:nth-child(2), .dc-preview-document .dc-items tbody td:nth-child(3) { padding: 3px 4px !important; font-size: 9px !important; line-height: 1.25 !important; white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
        .dc-preview-document .dc-items tbody td:nth-child(4) { white-space: normal !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
        .dc-preview-document .dc-items th:nth-child(1) { width: 5%; }
        .dc-preview-document .dc-items th:nth-child(2) { width: 17%; }
        .dc-preview-document .dc-items th:nth-child(3) { width: 19%; }
        .dc-preview-document .dc-items th:nth-child(4) { width: 13%; }
        .dc-preview-document .dc-items th:nth-child(5) { width: 6%; }
        .dc-preview-document .dc-items th:nth-child(6) { width: 10%; }
        .dc-preview-document .dc-items th:nth-child(7) { width: 10%; }
        .dc-preview-document .dc-items th:nth-child(8) { width: 9%; }
        .dc-preview-document .dc-items th:nth-child(9) { width: 11%; }
        .dc-preview-document .dc-totals { width: 44%; margin: 7px 0 0 auto; border-collapse: collapse; }
        .dc-preview-document .dc-totals th, .dc-preview-document .dc-totals td { padding: 4px 7px; border: 1px solid #cbd5dc; background: #fff; font-size: 9px !important; text-align: right; }
        .dc-preview-document .dc-totals .dc-grand-total th, .dc-preview-document .dc-totals .dc-grand-total td { background: #063B60; color: #fff; font-weight: 700; }
        .dc-preview-document .dc-amount-words { display: flex; align-items: center; gap: 10px; margin-top: 9px; padding: 10px; border: 1px solid #a9deea; border-radius: 6px; background: #eaf8fb; color: #063B60; }
        .dc-preview-document .dc-amount-words svg { flex: 0 0 22px; width: 22px; height: 22px; padding: 4px; border-radius: 50%; background: #063B60; color: #fff; }
        .dc-preview-document .dc-amount-content { display: grid; gap: 3px; }
        .dc-preview-document .dc-terms { margin-top: 9px; padding: 8px 9px; border-top: 1px solid #70aabe; border-right: 1px solid #70aabe; border-bottom: 1px solid #70aabe; border-left: 3px solid #079DB5; background: #fff; overflow-wrap: anywhere; line-height: 1.4; }
        .dc-preview-document .dc-terms li { break-inside: avoid; page-break-inside: avoid; margin-bottom: 3px; padding-left: 2px; }
        .dc-preview-document .dc-delivery-note { margin-top: 9px; padding: 7px; border: 1px solid #cbd5dc; background: #fff; font-weight: 700; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.4; }
        .dc-preview-document .dc-section-title { margin: 0 0 5px; color: #063B60; font-size: 10px; font-weight: 700; }
        .dc-preview-document .dc-terms .dc-section-title { display: flex; align-items: center; gap: 6px; }
        .dc-preview-document .dc-terms .dc-section-title svg { width: 14px; height: 14px; color: #08748b; }
        .dc-preview-document .dc-terms .dc-section-title { margin: -1px 0 6px; padding-top: 5px; }
        .dc-preview-document .dc-signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 10px; break-inside: avoid; page-break-inside: avoid; }
        .dc-preview-document .dc-signature { min-width: 0; min-height: 82px; padding: 8px; border: 1px solid #70aabe; background: #fff; display: flex; flex-direction: column; justify-content: space-between; overflow-wrap: anywhere; }
        .dc-preview-document .dc-signature strong { color: #063B60; }
        .dc-preview-document .dc-signature span { padding-top: 14px; border-top: 1px solid #9aaab4; color: #53636d; font-size: 8px; }
        .dc-preview-document .dc-footer { position: relative; min-height: 32px; margin-top: 10px; padding: 7px 0 2px; border-top: 1px solid #cbd5dc; color: #063B60; text-align: right; font-size: 9px; font-style: italic; }
        .dc-preview-document .dc-generated { margin: 4px 0 0; padding: 0 0 2mm; color: #53636d; text-align: center; font-size: 8px; font-style: normal; }
        .dc-preview-document .dc-footer::before, .dc-preview-document .dc-footer::after { position: absolute; bottom: 0; left: 0; width: 20%; height: 16px; content: ""; background: #063B60; clip-path: polygon(0 0, 76% 0, 100% 100%, 0 100%); }
        .dc-preview-document .dc-footer::after { left: 0; width: 14%; background: #079DB5; clip-path: polygon(0 0, 47% 0, 100% 100%, 0 100%); }
        .dc-preview-document .dc-keep { page-break-inside: auto; break-inside: auto; }
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body, #root { width: 100% !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
          body { position: relative !important; }
          body *:has(.dc-preview-root) { width: 100% !important; max-width: none !important; min-width: 0 !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          .dc-preview-document, .dc-preview-document * { visibility: visible !important; }
          .dc-preview-document, .dc-preview-document * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .dc-preview-controls { display: none !important; }
          .dc-preview-root { position: absolute !important; inset: 0 auto auto 0 !important; width: 194mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
            .dc-preview-document { width: 194mm !important; max-width: none !important; margin: 0 !important; padding: 5mm !important; border: 0.4mm solid #063B60 !important; box-shadow: none !important; background: #fff !important; font-size: 10px !important; break-after: auto !important; page-break-after: auto !important; }
          .dc-preview-document .dc-brandbar { min-height: 74px !important; padding: 6px 12px !important; }
          .dc-preview-document .dc-brand-logo { width: 56px !important; height: 60px !important; }
          .dc-preview-document .dc-brand-wordmark { right: 16px !important; }
          .dc-preview-document .dc-brand-wordmark strong { font-size: 19px !important; }
          .dc-preview-document .dc-header { min-height: 82px !important; padding: 8px 0 !important; }
          .dc-preview-document .dc-title { font-size: 21px !important; }
          .dc-preview-document .dc-company { font-size: 10px !important; }
          .dc-preview-document .dc-company-address { max-width: none !important; font-size: 10px !important; }
          .dc-preview-document .dc-grid { margin-top: 7px !important; }
          .dc-preview-document .dc-field { min-height: 34px !important; padding: 5px 7px !important; font-size: 10px !important; }
          .dc-preview-document .dc-field b { font-size: 9px !important; }
          .dc-preview-document .dc-parties { gap: 7px !important; margin-top: 7px !important; }
          .dc-preview-document .dc-party { min-height: 106px !important; padding: 0 7px 7px !important; font-size: 9px !important; }
          .dc-preview-document .dc-party h2 { font-size: 10px !important; }
          .dc-preview-document .dc-items { width: 100% !important; margin-top: 8px !important; }
          .dc-preview-document .dc-items th,
          .dc-preview-document .dc-items td { padding: 3px 4px !important; font-size: 9px !important; }
          .dc-preview-document .dc-items tbody td:nth-child(2),
          .dc-preview-document .dc-items tbody td:nth-child(3) { font-size: 8.5px !important; line-height: 1.25 !important; }
          .dc-preview-document .dc-totals { width: 44% !important; margin-top: 6px !important; }
          .dc-preview-document .dc-totals th,
          .dc-preview-document .dc-totals td { padding: 5px 7px !important; font-size: 10px !important; }
          .dc-preview-document .dc-amount-words { margin-top: 7px !important; padding: 8px !important; font-size: 10px !important; }
          .dc-preview-document .dc-terms,
          .dc-preview-document .dc-delivery-note { margin-top: 7px !important; padding: 7px !important; font-size: 9px !important; line-height: 1.35 !important; }
          .dc-preview-document .dc-section-title { font-size: 10px !important; }
          .dc-preview-document .dc-signatures { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; margin-top: 8px !important; }
          .dc-preview-document .dc-signature { min-height: 72px !important; padding: 7px !important; font-size: 9px !important; }
          .dc-preview-document .dc-signature span { font-size: 9px !important; }
          .dc-preview-document .dc-footer { min-height: 24px !important; margin-top: 8px !important; padding-top: 7px !important; }
          .dc-preview-document .dc-generated { padding-bottom: 0 !important; }
          .dc-preview-document .dc-brandbar, .dc-preview-document .dc-header, .dc-preview-document .dc-grid, .dc-preview-document .dc-parties, .dc-preview-document .dc-totals, .dc-preview-document .dc-amount-words, .dc-preview-document .dc-terms, .dc-preview-document .dc-delivery-note, .dc-preview-document .dc-signatures, .dc-preview-document .dc-footer { break-inside: avoid; page-break-inside: avoid; }
          .dc-preview-document .dc-items thead { display: table-header-group; }
          .dc-preview-document .dc-items tbody tr { height: auto !important; min-height: 0 !important; break-inside: avoid; page-break-inside: avoid; }
          .dc-preview-document .dc-brandbar::before, .dc-preview-document .dc-brandbar::after, .dc-preview-document .dc-footer::before, .dc-preview-document .dc-footer::after { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
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
        <div className="dc-brandbar" aria-label="Synov brand banner">
          <div className="dc-brand-identity">
            <img className="dc-brand-logo" alt="Synov logo" src={COMPANY_PROFILE.logoUrl} />
          </div>
          <div className="dc-brand-wordmark"><strong>SYNOV</strong><span>Stronger Together</span></div>
        </div>
        <header className="dc-header">
          <h1 className="dc-title">Delivery Challan</h1>
          <div className="dc-company">{COMPANY_PROFILE.name}</div>
          <div className="dc-company-address">{COMPANY_PROFILE.address}</div>
          <div className="dc-header-gst">GST No: {COMPANY_PROFILE.gstNumber}</div>
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
            party={{
              name: COMPANY_PROFILE.name,
              address: COMPANY_PROFILE.address,
              gstNumber: COMPANY_PROFILE.gstNumber,
              email: 'pavan@3Vikram.in',
            }}
            icon={<Truck aria-hidden="true" />}
          />
          <PartyBox
            title="Bill To"
            party={{
              ...billTo,
              name: billTo.name || challan.customerName,
              customerName: billTo.customerName || challan.customerName,
            }}
            icon={<UserRound aria-hidden="true" />}
          />
          <PartyBox
            title="DC For"
            party={{
              ...dcFor,
              name: dcFor.name || challan.customerName,
              contactPerson: dcFor.contactPerson || challan.contactPerson,
            }}
            icon={<Building2 aria-hidden="true" />}
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
              <tr className="dc-grand-total"><th>Grand Total</th><td><strong>{challan.currency || 'INR'} {money(grandTotal)}</strong></td></tr>
            </tbody>
          </table>
          {challan.deliveryNote?.trim() && (
            <section className="dc-delivery-note">
              <strong>Delivery Note:</strong>{' '}
              <span>{challan.deliveryNote}</span>
            </section>
          )}
          <section className="dc-terms">
            <h2 className="dc-section-title"><ReceiptText aria-hidden="true" />Terms &amp; Conditions</h2>
            <ol className="m-0 list-decimal space-y-1 pl-4">
              {DELIVERY_CHALLAN_TERMS.map((term) => <li key={term}>{term}</li>)}
            </ol>
          </section>
          <section className="dc-amount-words">
            <IndianRupee aria-hidden="true" />
            <div className="dc-amount-content">
              <h2 className="dc-section-title">Amount in Words:</h2>
              <strong>{numberToWords(grandTotal)} Rupees Only</strong>
            </div>
          </section>
          <div className="dc-signatures">
            <section className="dc-signature">
              <strong>For Synov IT Services Pvt Ltd</strong>
              <span>Authorized Signatory</span>
            </section>
            <section className="dc-signature">
              <strong>Received By Navikra Tech Solutions Pvt Ltd</strong>
              <span>Signature &amp; Seal</span>
            </section>
          </div>
          <footer className="dc-footer">
            <span>Technology for a better tomorrow</span>
            <p className="dc-generated">This is an electronically generated document, signature not required.</p>
          </footer>
        </div>
      </article>
    </div>
  )
}
