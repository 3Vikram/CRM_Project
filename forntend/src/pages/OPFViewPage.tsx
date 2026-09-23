'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Pencil, Printer, Send } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { Toast } from '@/components/toast'
import { fetchCompanyProfiles, type CompanyProfileRecord } from '@/lib/companyProfileApi'
import { fetchCustomerById, type CustomerApiRecord } from '@/lib/customerApi'
import { fetchLeads, type LeadRecord } from '@/lib/leadApi'
import { fetchOPFById, sendOPFPdf, type OPFRecord } from '@/lib/opfApi'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

const formatDate = (value?: string | null) => {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-GB')
}

const formatCurrency = (value?: number | string) => {
  const numeric = Number(value ?? 0)
  if (!Number.isFinite(numeric)) return '₹0'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(numeric)
}

const taxDetails = (tax?: string) => {
  const match = tax?.match(/(\d+(?:\.\d+)?)%/)
  const percentage = match ? Number(match[1]) : 0
  return { percentage, isCGST: tax?.includes('CGST + SGST') ?? false }
}

const calculateGST = (subtotal: number, tax?: string) => {
  const { percentage, isCGST } = taxDetails(tax)
  const totalGST = subtotal * percentage / 100
  return { cgst: isCGST ? totalGST / 2 : 0, sgst: isCGST ? totalGST / 2 : 0, igst: isCGST ? 0 : totalGST, totalGST }
}

const numberToWords = (value: number): string => {
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  if (value < 20) return ones[value]
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ''}`
  if (value < 1000) return `${ones[Math.floor(value / 100)]} Hundred${value % 100 ? ` and ${numberToWords(value % 100)}` : ''}`
  if (value < 100000) return `${numberToWords(Math.floor(value / 1000))} Thousand${value % 1000 ? ` ${numberToWords(value % 1000)}` : ''}`
  if (value < 10000000) return `${numberToWords(Math.floor(value / 100000))} Lakh${value % 100000 ? ` ${numberToWords(value % 100000)}` : ''}`
  return `${numberToWords(Math.floor(value / 10000000))} Crore${value % 10000000 ? ` ${numberToWords(value % 10000000)}` : ''}`
}

const resolveImageUrl = (filePath?: string) => {
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) return filePath
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '')
  return `${base}${filePath}`
}

export default function OPFViewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const printRef = useRef<HTMLDivElement | null>(null)
  const [opf, setOPF] = useState<OPFRecord | null>(null)
  const [company, setCompany] = useState<CompanyProfileRecord | null>(null)
  const [customer, setCustomer] = useState<CustomerApiRecord | null>(null)
  const [quotation, setQuotation] = useState<LeadRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message
    if (message) {
      setToast(message)
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate])

  useEffect(() => {
    const load = async () => {
      if (!id) return
      try {
        const data = await fetchOPFById(id)
        if (!data) throw new Error('OPF not found')
        setOPF(data)
        const [profileResponse, quotationResponse] = await Promise.all([
          fetchCompanyProfiles({ limit: 1 }),
          fetchLeads({ status: 'Proposal Sent', limit: 1000 }),
        ])
        setCompany(profileResponse.data?.[0] || null)
        setQuotation(quotationResponse.data.find((lead) =>
          lead.quotationId === data.quotationId || lead.quotationId === data.quotationNumber
        ) || null)
        if (data.customerId) {
          const customerResponse = await fetchCustomerById(data.customerId)
          setCustomer(customerResponse.data || customerResponse)
        }
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Failed to load OPF')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [id])

  if (isLoading) return <div className="py-8 text-center text-gray-500">Loading OPF details...</div>
  if (!opf || !id) return <div className="py-8 text-center text-gray-500">OPF not found.</div>

  const quantity = Number(opf.quantity) || 0
  const customerSubtotal = quantity * (Number(opf.unitPrice) || 0)
  const vendorSubtotal = quantity * (Number(opf.vendorPrice) || 0)
  const customerGST = calculateGST(customerSubtotal, opf.tax)
  const vendorGST = calculateGST(vendorSubtotal, opf.tax)
  const customerTotal = customerSubtotal + customerGST.totalGST
  const vendorTotal = vendorSubtotal + vendorGST.totalGST
  const gp = customerSubtotal - vendorSubtotal
  const logoUrl = resolveImageUrl(company?.companyLogo?.filePath)
  const quotationProduct = quotation?.products?.[0]
  const customerName = quotation?.companyName || opf.customerName
  const product = quotationProduct?.productName || opf.product
  const description = quotationProduct?.productDescription || opf.description

  const handleSendPdf = async () => {
    if (!printRef.current) return
    const recipient = opf.enduserEmail || window.localStorage.getItem('userEmail') || ''
    if (!recipient) {
      setToast('No recipient email is available for this OPF')
      return
    }
    setIsSending(true)
    try {
      const pdfData = await html2pdf().set({
        margin: 0,
        filename: `opf-${opf.opfNo || id}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      }).from(printRef.current).outputPdf('datauristring')
      const response = await sendOPFPdf(id, pdfData, recipient)
      setToast(response.message || 'OPF PDF sent successfully')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Failed to send OPF PDF')
    } finally {
      setIsSending(false)
    }
  }

  const handlePrint = () => window.print()

  return (
    <div className="opf-view-root space-y-6">
      <style>{`
        .opf-view-root {
          width: 100%;
          min-height: 100vh;
          background: #f3f4f6;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 20px 24px;
          box-sizing: border-box;
        }
        .opf-page {
          width: 100%;
          min-height: 0;
          max-width: none;
          margin: 0;
          box-sizing: border-box;
          --opf-inset: 12px;
          padding: 24px;
          border: 0;
          background: #fff;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 11px;
        }
        .opf-header { position: relative; display: flex; min-height: 82px; align-items: center; justify-content: center; border-top: 1px solid #333; border-bottom: 1px solid #333; margin-bottom: 12px; padding: 8px 0; box-sizing: border-box; }
        .opf-header h1 { margin: 0; font-size: 20px; font-weight: 700; text-transform: uppercase; }
        .opf-header img { position: absolute; right: 0; max-width: 190px; height: 64px; object-fit: contain; }
        .opf-meta {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 20px;
          border-bottom: 1px solid #333;
          margin: 0 calc(var(--opf-inset) * -1);
          padding: 10px var(--opf-inset) 14px;
          box-sizing: border-box;
          align-items: start;
        }
        .opf-meta > div { min-width: 0; box-sizing: border-box; }
        .opf-meta .opf-detail-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          min-width: 0;
          width: 100%;
          gap: 2px;
        }
        .opf-meta .opf-detail-label {
          font-weight: 700;
          white-space: nowrap;
          line-height: 1.35;
        }
        .opf-meta .opf-detail-row span:last-child {
          min-width: 0;
          line-height: 1.4;
          word-break: normal;
          overflow-wrap: break-word;
          color: #111;
        }
        .opf-section { margin-top: 22px; }
        .opf-section h3 { margin: 0 0 9px; font-size: 14px; font-weight: 700; }
        .opf-table {
          width: 100%;
          max-width: 100%;
          border: 0.5px solid #333;
          border-collapse: collapse;
          border-spacing: 0;
          table-layout: fixed;
          font-size: 11px;
          line-height: 1.45;
          box-sizing: border-box;
        }
        .opf-table colgroup col:nth-child(1) { width: 5%; }
        .opf-table colgroup col:nth-child(2) { width: 14%; }
        .opf-table colgroup col:nth-child(3) { width: 9%; }
        .opf-table colgroup col:nth-child(4) { width: 15%; }
        .opf-table colgroup col:nth-child(5) { width: 6%; }
        .opf-table colgroup col:nth-child(6) { width: 5%; }
        .opf-table colgroup col:nth-child(7) { width: 10%; }
        .opf-table colgroup col:nth-child(8) { width: 10%; }
        .opf-table colgroup col:nth-child(9) { width: 17%; }
        .opf-table colgroup col:nth-child(10) { width: 9%; }
        .opf-table th, .opf-table td {
          border: 0.5px solid #333;
          padding: 8px 6px;
          overflow-wrap: break-word;
          word-break: normal;
          vertical-align: middle;
          box-sizing: border-box;
        }
        .opf-table thead th {
          font-weight: 700;
          text-align: center;
          vertical-align: middle;
          background: rgba(0,0,0,0.02);
        }
        .opf-table tbody tr { break-inside: avoid; page-break-inside: avoid; }
        .opf-table .opf-number {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          padding-left: 5px;
          padding-right: 7px;
          vertical-align: middle;
        }
        .opf-table td:not(.opf-number) {
          white-space: normal;
        }
        .opf-gst-cell {
          position: relative;
          padding: 0 !important;
          min-width: 0;
          text-align: center;
        }
        .opf-gst {
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          min-height: 100%;
          align-items: stretch;
          overflow: visible;
          background: #fff;
          position: relative;
        }
        .opf-gst > div {
          min-width: 0;
          min-height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-self: stretch;
          padding: 6px 8px;
          box-sizing: border-box;
        }
        .opf-gst > div:first-child { border-right: 0.5px solid #333; }
        .opf-gst-label {
          padding: 0 2px 4px;
          font-size: inherit;
          font-weight: 700;
          text-align: center;
          white-space: nowrap;
          overflow: visible;
        }
        .opf-gst-value {
          padding: 4px 2px 0;
          font-size: inherit;
          text-align: center;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }
        .opf-summary-row td { padding: 9px 7px; }
        .opf-summary-label { text-align: right; vertical-align: middle; }
        .opf-summary-row .opf-number { padding-right: 7px; }
        .opf-bottom {
          display: grid;
          grid-template-columns: minmax(0, 4fr) minmax(0, 1fr);
          margin-top: 24px;
          border-top: 1px solid #333;
          padding-top: 16px;
          font-size: 12px;
          line-height: 1.5;
        }
        .opf-bottom-details { display: grid; gap: 6px; padding: 0 20px 12px 0; }
        .opf-bottom-details .opf-detail-row { min-height: 18px; }
        .opf-detail-row { display: flex; align-items: flex-start; gap: 8px; }
        .opf-detail-label { min-width: 150px; font-weight: 700; flex-shrink: 0; }
        .opf-signature {
          display: flex;
          min-height: 210px;
          align-items: flex-end;
          justify-content: center;
          border-left: 0.5px solid #333;
          padding: 20px 12px;
          text-align: center;
          font-weight: 700;
          font-size: inherit;
        }
        @media (max-width: 720px) {
          .opf-view-root { padding: 12px; }
          .opf-page { width: 100%; max-width: none; min-height: 0; --opf-inset: 6px; padding: 12px; font-size: 10px; }
          .opf-header { min-height: 48px; }
          .opf-header h1 { font-size: 10px; }
          .opf-header img { max-width: 78px; height: 34px; }
          .opf-meta { gap: 6px; padding-top: 6px; padding-bottom: 8px; font-size: 9px; }
          .opf-section { margin-top: 14px; }
          .opf-section h3 { margin-bottom: 5px; font-size: 11px; }
          .opf-table { font-size: 9px; }
          .opf-table th, .opf-table td { padding: 5px 3px; }
          .opf-gst > div { padding: 6px 4px; }
          .opf-gst-label, .opf-gst-value { font-size: inherit; }
          .opf-gst-line { margin-top: 2px; }
          .opf-bottom { grid-template-columns: minmax(0, 3fr) minmax(0, 1fr); margin-top: 14px; padding-top: 10px; font-size: 10px; line-height: 1.35; }
          .opf-bottom-details { gap: 4px; padding: 0 6px 6px 0; }
          .opf-detail-row { gap: 4px; }
          .opf-detail-label { min-width: 105px; }
          .opf-signature { min-height: 120px; padding: 8px 4px; font-size: inherit; }
        }
        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body, #root { width: auto !important; height: auto !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; overflow: visible !important; }
          body * { visibility: hidden !important; }
          .opf-print-area, .opf-print-area * { visibility: visible !important; }
          .opf-view-root { position: static !important; width: 100% !important; min-width: 0 !important; margin: 0 !important; padding: 0 !important; background: #fff !important; display: block !important; }
          .no-print { display: none !important; }
          button, [role="alert"] { display: none !important; }
          .opf-print-area { display: block !important; position: relative !important; left: 0 !important; top: 0 !important; width: 210mm !important; min-height: 297mm !important; max-width: 210mm !important; margin: 0 auto !important; padding: 4mm !important; box-sizing: border-box !important; transform: none !important; zoom: 1 !important; background: #fff !important; border: 1px solid #333 !important; overflow: visible !important; }
          .opf-print-area .opf-table { width: 100% !important; max-width: 100% !important; table-layout: auto !important; border-collapse: collapse !important; overflow: visible !important; }
          .opf-print-area .opf-table thead { display: table-header-group !important; }
          .opf-print-area .opf-table tr { break-inside: avoid; page-break-inside: avoid; }
          .opf-print-area .opf-table th, .opf-print-area .opf-table td { overflow-wrap: break-word !important; word-break: normal !important; white-space: normal !important; }
          .opf-print-area .opf-table .opf-number, .opf-print-area .opf-gst-value { white-space: nowrap !important; overflow-wrap: normal !important; word-break: normal !important; }
          .opf-print-area { font-size: 8px !important; }
          .opf-print-area .opf-table { font-size: 8px !important; line-height: 1.35 !important; }
          .opf-print-area .opf-table th, .opf-print-area .opf-table td { padding: 3px 4px !important; }
          .opf-print-area .opf-gst > div { padding: 3px 2px !important; }
          .opf-print-area .opf-gst-label { padding: 0 2px 2px !important; font-size: inherit !important; }
          .opf-print-area .opf-gst-value { padding: 2px 2px 0 !important; font-size: inherit !important; }
          .opf-print-area .opf-summary-row td { padding: 4px 6px !important; }
          .opf-print-area .opf-bottom { margin-top: 13px !important; border-top: 0 !important; padding-top: 0 !important; font-size: 10px !important; line-height: 1.45 !important; }
          .opf-print-area .opf-bottom-details { gap: 3px !important; padding: 7px 14px 7px 0 !important; }
          .opf-print-area .opf-detail-row { gap: 6px !important; }
          .opf-print-area .opf-detail-label { min-width: 120px !important; }
          .opf-print-area .opf-signature { min-height: 190px !important; padding: 12px !important; font-size: inherit !important; }
          .opf-print-area .opf-gst { position: relative !important; overflow: visible !important; }
          .opf-print-area .opf-gst-label, .opf-print-area .opf-gst-value { white-space: nowrap !important; overflow-wrap: normal !important; word-break: normal !important; }
          .opf-print-area .opf-bottom { width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; }
          .opf-print-area .opf-header, .opf-print-area .opf-meta, .opf-print-area .opf-section, .opf-print-area .opf-bottom { break-inside: avoid; page-break-inside: avoid; }
          .opf-print-area .opf-header { position: relative !important; display: flex !important; min-height: 68px !important; align-items: center !important; justify-content: center !important; border-bottom: 1px solid #333 !important; }
          .opf-print-area .opf-header h1 { margin: 0 !important; text-align: center !important; }
          .opf-print-area .opf-header img { position: absolute !important; top: 5px !important; right: 5px !important; max-width: 35% !important; }
        }
      `}</style>
      <button type="button" onClick={() => navigate('/sales/opf')} className="no-print inline-flex items-center gap-2 text-sm font-semibold text-[#111827] hover:underline"><ArrowLeft className="h-4 w-4" /> Back to OPF</button>
      <div className="no-print flex items-center justify-between">
        <div />
        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/sales/opf/edit/${id}`)} className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E293B]"><Pencil className="h-4 w-4" /> EDIT</button>
          <button type="button" onClick={handlePrint} className="no-print inline-flex items-center gap-2 rounded-lg border border-[#111827] bg-white px-4 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F2EFE8]"><Printer className="h-4 w-4" /> PRINT</button>
          <button type="button" disabled={isSending} onClick={handleSendPdf} className="inline-flex items-center gap-2 rounded-lg border border-[#111827] bg-white px-4 py-2.5 text-sm font-medium text-[#111827] hover:bg-[#F2EFE8] disabled:opacity-50"><Send className="h-4 w-4" /> View &amp; Send PDF</button>
        </div>
      </div>

      <div ref={printRef} className="opf-page opf-print-area mx-auto bg-white text-black">
        <header className="opf-header">
          <h1>Order Processing Format</h1>
          {logoUrl && <img src={logoUrl} alt="Synov logo" />}
        </header>

        <section className="opf-meta">
          <Detail label="Quot No" value={opf.quotationNumber || quotation?.quotationId} />
          <Detail label="PO No" value={opf.customerPONo} />
          <Detail label="OPF No" value={opf.opfNo} />
          <Detail label="OPF Date" value={formatDate(opf.createdDate)} />
          <Detail label="Created By Sales Rep" value={opf.createdBy} />
        </section>

        <DataTable title="Customer Details" name={customerName} product={product} description={description} partNo={opf.partNo} quantity={quantity} unitPrice={Number(opf.unitPrice) || 0} tax={opf.tax} subtotal={customerSubtotal} gst={customerGST} total={customerTotal} />
        <VendorDataTable name={opf.supplierName} product={product} description={description} partNo={opf.partNo} quantity={quantity} unitPrice={Number(opf.vendorPrice) || 0} tax={opf.tax} subtotal={vendorSubtotal} gst={vendorGST} total={vendorTotal} gp={gp} gpPercentage={vendorSubtotal ? (gp / vendorSubtotal) * 100 : 0} />

        <section className="opf-bottom">
          <div className="opf-bottom-details">
            <Detail label="GP in Words" value={`${numberToWords(Math.abs(Math.round(gp)))} Rupee Only`} />
            <Detail label="PO No" value={opf.customerPONo} />
            <Detail label="PO Date" value={formatDate(opf.customerPODate)} />
            <Detail label="ETA" value={formatDate(opf.eta)} />
            <Detail label="Enduser Name" value={opf.enduserName} />
            <Detail label="Enduser Email" value={opf.enduserEmail} />
            <Detail label="Enduser Contact" value={opf.enduserContact} />
            <Detail label="Enduser Address" value={opf.enduserAddress} />
            <Detail label="Customer GST No." value={customer?.gstNumber} />
            <Detail label="Customer Payment Terms" value={opf.customerPaymentTerms} />
            <Detail label="Supplier Payment Terms" value={opf.supplierPaymentTerms} />
            <Detail label="Bill To Address" value={opf.billToAddress} />
            <Detail label="Ship To Address" value={opf.shipToAddress} />
          </div>
          <div className="opf-signature">Authorised Signatory</div>
        </section>
      </div>
      {toast && <div className="no-print"><Toast message={toast} type={toast.includes('success') ? 'success' : 'error'} onClose={() => setToast(null)} /></div>}
    </div>
  )
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="opf-detail-row"><span className="opf-detail-label">{label}:</span><span>{value || '-'}</span></div>
}

function GstCell({ tax, gst }: { tax?: string; gst: { cgst: number; sgst: number; igst: number; totalGST: number } }) {
  const halfTaxPercentage = taxDetails(tax).percentage / 2
  return (
    <div className="opf-gst">
      <div>
        <div className="opf-gst-label">CGST {halfTaxPercentage}%</div>
        <div className="opf-gst-line" />
        <div className="opf-gst-value">{formatCurrency(gst.cgst)}</div>
      </div>
      <div>
        <div className="opf-gst-label">SGST {halfTaxPercentage}%</div>
        <div className="opf-gst-line" />
        <div className="opf-gst-value">{formatCurrency(gst.sgst)}</div>
      </div>
    </div>
  )
}

function VendorDataTable({ name, product, description, partNo, quantity, unitPrice, tax, subtotal, gst, total, gp, gpPercentage }: { name?: string; product?: string; description?: string; partNo?: string; quantity: number; unitPrice: number; tax?: string; subtotal: number; gst: { cgst: number; sgst: number; igst: number; totalGST: number }; total: number; gp: number; gpPercentage: number }) {
  return <section className="opf-section"><h3>Vendor/Supplier Details</h3><OPFTable nameLabel="Vendor Name" name={name} product={product} description={description} partNo={partNo} quantity={quantity} unitPrice={unitPrice} tax={tax} subtotal={subtotal} gst={gst} total={total} footer={<><tr className="font-semibold opf-summary-row"><td colSpan={7} className="opf-summary-label">Grand Total</td><td className="opf-number">{formatCurrency(subtotal)}</td><td className="opf-number">{formatCurrency(gst.totalGST)}</td><td className="opf-number">{formatCurrency(total)}</td></tr><tr className="font-semibold opf-summary-row"><td colSpan={9} className="opf-summary-label">GP</td><td className="opf-number">{formatCurrency(gp)}</td></tr><tr className="font-semibold opf-summary-row"><td colSpan={9} className="opf-summary-label">GP %</td><td className="opf-number">{gpPercentage.toFixed(2)}%</td></tr></>} /></section>
}

function DataTable({ title, name, product, description, partNo, quantity, unitPrice, tax, subtotal, gst, total }: { title: string; name?: string; product?: string; description?: string; partNo?: string; quantity: number; unitPrice: number; tax?: string; subtotal: number; gst: { cgst: number; sgst: number; igst: number; totalGST: number }; total: number }) {
  const nameLabel = title.startsWith('Vendor') ? 'Vendor Name' : 'Customer Name'
  return <section className="opf-section"><h3>{title}</h3><OPFTable nameLabel={nameLabel} name={name} product={product} description={description} partNo={partNo} quantity={quantity} unitPrice={unitPrice} tax={tax} subtotal={subtotal} gst={gst} total={total} footer={<tr className="font-semibold opf-summary-row"><td colSpan={7} className="opf-summary-label">Grand Total</td><td className="opf-number">{formatCurrency(subtotal)}</td><td className="opf-number">{formatCurrency(gst.totalGST)}</td><td className="opf-number">{formatCurrency(total)}</td></tr>} /></section>
}

function OPFTable({ nameLabel, name, product, description, partNo, quantity, unitPrice, tax, subtotal, gst, total, footer }: { nameLabel: string; name?: string; product?: string; description?: string; partNo?: string; quantity: number; unitPrice: number; tax?: string; subtotal: number; gst: { cgst: number; sgst: number; igst: number; totalGST: number }; total: number; footer: React.ReactNode }) {
  return (
    <table className="opf-table" style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
      <colgroup>
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <th>Sl. No.</th>
          <th>{nameLabel}</th>
          <th>Product</th>
          <th>Description</th>
          <th>Part No.</th>
          <th>Qty</th>
          <th>Unit Price (INR)</th>
          <th>Sub Total (INR)</th>
          <th>GST (INR)</th>
          <th>Total Price (INR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="text-center">1</td>
          <td>{name || '-'}</td>
          <td>{product || '-'}</td>
          <td>{description || '-'}</td>
          <td>{partNo || '-'}</td>
          <td className="text-center">{quantity}</td>
          <td className="opf-number">{formatCurrency(unitPrice)}</td>
          <td className="opf-number">{formatCurrency(subtotal)}</td>
          <td className="opf-gst-cell">
            <div className="opf-gst">
              <div>
                <div className="opf-gst-label">CGST {taxDetails(tax).percentage / 2}%</div>
                <div className="opf-gst-value">{formatCurrency(gst.cgst)}</div>
              </div>
              <div>
                <div className="opf-gst-label">SGST {taxDetails(tax).percentage / 2}%</div>
                <div className="opf-gst-value">{formatCurrency(gst.sgst)}</div>
              </div>
            </div>
          </td>
          <td className="opf-number font-semibold">{formatCurrency(total)}</td>
        </tr>
        {footer}
      </tbody>
    </table>
  )
}