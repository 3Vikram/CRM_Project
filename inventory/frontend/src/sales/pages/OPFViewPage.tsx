'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader, Pencil } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { Toast } from '@/sales/components/toast'
import { fetchCompanyProfiles, type CompanyProfileRecord } from '@/sales/lib/companyProfileApi'
import { fetchCustomerById, type CustomerApiRecord } from '@/sales/lib/customerApi'
import { fetchLeads, type LeadRecord } from '@/sales/lib/leadApi'
import { fetchOPFById, type OPFRecord } from '@/sales/lib/opfApi'
import { useLocation, useNavigate, useParams } from 'react-router-dom'

const formatDate = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-GB')
}

const formatAmount = (value?: number | string | null) => {
  if (value === undefined || value === null || value === '') return ''
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric)
}

const opfPdfOptions = {
  margin: 0,
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
  jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
}
const pdfOptions = opfPdfOptions

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

const waitForImages = async (element: HTMLElement) => {
  await Promise.all(Array.from(element.querySelectorAll('img')).map((image) => new Promise<void>((resolve, reject) => {
    if (image.complete) {
      if (image.naturalWidth > 0) resolve()
      else reject(new Error('An OPF image failed to load'))
      return
    }
    image.addEventListener('load', () => resolve(), { once: true })
    image.addEventListener('error', () => reject(new Error('An OPF image failed to load')), { once: true })
  })))
}

const waitForLayout = async () => {
  try {
    await document.fonts?.ready
  } catch {
    // ignore font loading problems
  }
  await new Promise((resolve) => setTimeout(resolve, 300))
}

const isCanvasBlank = (canvas: HTMLCanvasElement) => {
  if (!canvas.width || !canvas.height) return true
  const sample = document.createElement('canvas')
  sample.width = 60
  sample.height = 84
  const context = sample.getContext('2d')
  if (!context) return false
  context.drawImage(canvas, 0, 0, sample.width, sample.height)
  const { data } = context.getImageData(0, 0, sample.width, sample.height)
  for (let index = 0; index < data.length; index += 4) {
    if (data[index] < 252 || data[index + 1] < 252 || data[index + 2] < 252) return false
  }
  return true
}

export default function OPFViewPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const pageMode = new URLSearchParams(location.search).get('page') === '1'
  const [pdfFailed, setPdfFailed] = useState(false)
  const showPage = pageMode || pdfFailed
  const printRef = useRef<HTMLDivElement | null>(null)
  const hasStartedPdf = useRef(false)
  const [opf, setOPF] = useState<OPFRecord | null>(null)
  const [company, setCompany] = useState<CompanyProfileRecord | null>(null)
  const [customer, setCustomer] = useState<CustomerApiRecord | null>(null)
  const [quotation, setQuotation] = useState<LeadRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message
    if (message) {
      setToast(message)
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
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

  useEffect(() => {
    if (isLoading || !opf || !printRef.current || showPage || hasStartedPdf.current) return

    hasStartedPdf.current = true
    const element = printRef.current
    const openPdf = async () => {
      try {
        await waitForImages(element)
        await waitForLayout()
        const pdfUrl = await new Promise<string>((resolve, reject) => {
          const worker: any = html2pdf().set(pdfOptions).from(element)
          worker
            .toCanvas()
            .get('canvas')
            .then((canvas: HTMLCanvasElement) => {
              if (isCanvasBlank(canvas)) {
                throw new Error('The PDF came out blank, so the OPF page is shown instead.')
              }
            })
            .toPdf()
            .get('pdf')
            .then((pdf: any) => {
              pdf.setProperties({ title: `OPF ${opf.opfNo || ''}`.trim() })
              resolve(pdf.output('bloburl') as string)
            })
            .catch((error: any) => reject(error))
        })

        window.location.replace(pdfUrl)
      } catch (error) {
        setPdfFailed(true)
        setToast(error instanceof Error ? error.message : 'Failed to generate OPF PDF')
      }
    }

    void openPdf()
  }, [isLoading, opf, company, customer, quotation, showPage])

  if (isLoading) return <div className="py-8 text-center text-gray-500">Loading OPF details...</div>
  if (!opf || !id) {
    return (
      <div className="py-8 text-center text-gray-500">
        OPF not found.
        {toast && <Toast message={toast} type="error" onClose={() => setToast(null)} />}
      </div>
    )
  }

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

  const gpPercentage = vendorSubtotal ? (gp / vendorSubtotal) * 100 : 0
  const quantityDisplay = opf.quantity === undefined || opf.quantity === null || opf.quantity === '' ? '' : quantity
  const detailRows: Array<[string, string | number | null | undefined]> = [
    ['GP in Words', `${numberToWords(Math.abs(Math.round(gp)))} rupee Only.`], ['PO No', opf.customerPONo], ['PO Date', formatDate(opf.customerPODate)], ['ETA', formatDate(opf.eta)], ['Enduser Name', opf.enduserName], ['Enduser Email', opf.enduserEmail], ['Enduser Contact', opf.enduserContact], ['Enduser Address', opf.enduserAddress], ['Customer GST No.', customer?.gstNumber], ['Customer Payment Terms', opf.customerPaymentTerms], ['Supplier Payment Terms', opf.supplierPaymentTerms], ['Bill To Address', opf.billToAddress], ['Ship To Address', opf.shipToAddress],
  ]

  const documentNode = (
    <div ref={printRef} className="opf-doc-shell">
      <div className="opf-doc">
        <div className="opf-head">
          <h1>Order Processing Format</h1>
          {logoUrl && <img src={logoUrl} alt="Company logo" />}
        </div>

        <div className="opf-meta">
          <div>Quot No: <span>{opf.quotationNumber || quotation?.quotationId || ''}</span></div>
          <div>PO No: <span>{opf.customerPONo || ''}</span></div>
          <div>OPF No: <span>{opf.opfNo || ''}</span></div>
          <div>OPF Date: <span>{formatDate(opf.createdDate)}</span></div>
          <div>Created By Sales Rep: <span>{opf.createdBy || ''}</span></div>
        </div>

        <OPFTable
          title="Customer Details"
          nameLabel="Customer Name"
          name={customerName || ''}
          product={product || ''}
          description={description || ''}
          partNo={opf.partNo || ''}
          quantity={quantityDisplay}
          unitPrice={opf.unitPrice}
          tax={opf.tax}
          subtotal={customerSubtotal}
          gst={customerGST}
          total={customerTotal}
        />

        <OPFTable
          title="Vendor/Supplier Details"
          nameLabel="Vendor Name"
          name={opf.supplierName || ''}
          supplierContactPerson={opf.supplierContactPerson}
          product={product || ''}
          description={description || ''}
          partNo={opf.partNo || ''}
          quantity={quantityDisplay}
          unitPrice={opf.vendorPrice}
          tax={opf.tax}
          subtotal={vendorSubtotal}
          gst={vendorGST}
          total={vendorTotal}
          vendor
          startDate={opf.startDate}
          endDate={opf.endDate}
          gp={gp}
          gpPercentage={gpPercentage}
        />

        <div className="opf-bottom">
          <div className="opf-details">
            {detailRows.map(([label, value]) => <Detail key={label} label={label} value={value} />)}
          </div>
          <div className="opf-sign">Authorised Signatory</div>
        </div>
      </div>
    </div>
  )

  const styles = (
    <style>{`
        .opf-doc-shell { width:100%; max-width:794px; margin:0 auto; padding:14px; box-sizing:border-box; background:#fff; }
        .opf-doc-shell .opf-doc { border:1px solid #000; color:#000; font-family:"Times New Roman",Times,serif; box-sizing:border-box; }
        .opf-doc-shell .opf-doc * { font-family:"Times New Roman",Times,serif; font-size:9.33px; line-height:12px; box-sizing:border-box; }
        .opf-doc-shell .opf-head { position:relative; height:94px; padding:23px 50px 0 0; border-bottom:1px solid #000; text-align:center; }
        .opf-doc-shell .opf-head h1 { margin:0; font-size:13.33px; line-height:16px; font-weight:bold; text-transform:uppercase; }
        .opf-doc-shell .opf-head img { position:absolute; top:4px; right:5px; height:80px; width:auto; max-width:200px; object-fit:contain; }
        .opf-doc-shell .opf-meta { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); padding:5px 0 5px 11px; border-bottom:1px solid #000; }
        .opf-doc-shell .opf-meta div { font-size:13.33px; line-height:17px; font-weight:bold; padding-right:6px; }
        .opf-doc-shell .opf-meta div span { font-size:13.33px; line-height:17px; font-weight:bold; white-space:nowrap; }
        .opf-doc-shell .opf-title { padding:5px 5px 6px; border-bottom:1px solid #000; font-size:13.33px; line-height:17px; font-weight:bold; }
        .opf-doc-shell .opf-table { width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; }
        .opf-doc-shell .opf-table th, .opf-doc-shell .opf-table td { border:none; border-right:1px solid #000; border-bottom:1px solid #000; padding:5px 3px 5px 5px; text-align:left; vertical-align:top; }
        .opf-doc-shell .opf-table td { overflow-wrap:anywhere; }
        .opf-doc-shell .opf-table th { font-weight:bold; }
        .opf-doc-shell .opf-table tr > *:last-child { border-right:none; }
        .opf-doc-shell .opf-table .opf-total td { font-weight:bold; vertical-align:middle; }
        .opf-doc-shell .opf-table .opf-total td * { font-weight:bold; }
        .opf-doc-shell .opf-dash { color:#333; }
        .opf-doc-shell .opf-bottom { display:grid; grid-template-columns:minmax(0,1fr) 153px; }
        .opf-doc-shell .opf-details { padding:6px 6px 19px; }
        .opf-doc-shell .opf-details div, .opf-doc-shell .opf-details div span { font-size:10.67px; line-height:13.5px; }
        .opf-doc-shell .opf-details b { font-size:10.67px; }
        .opf-doc-shell .opf-sign { display:flex; align-items:center; justify-content:center; padding-top:40px; border-left:1px solid #000; font-size:10.67px; font-weight:bold; text-align:center; }
        @layer base {
          .opf-doc-shell .opf-doc * { font-size:9.33px !important; }
          .opf-doc-shell .opf-head h1 { font-size:13.33px !important; }
          .opf-doc-shell .opf-meta div, .opf-doc-shell .opf-meta div span { font-size:13.33px !important; }
          .opf-doc-shell .opf-title { font-size:13.33px !important; }
          .opf-doc-shell .opf-details div, .opf-doc-shell .opf-details div span, .opf-doc-shell .opf-details b { font-size:10.67px !important; }
          .opf-doc-shell .opf-sign { font-size:10.67px !important; }
        }
        .opf-web-card { background:#fff; border:1px solid #e5e7eb; border-radius:4px; padding:55px 31px 28px; color:#212121; box-sizing:border-box; }
        .opf-web-card * { box-sizing:border-box; }
        .opf-web-card .opf-web-head { display:grid; grid-template-columns:minmax(0,1fr) 316px; align-items:center; height:148px; border-top:1px solid #333; border-bottom:1px solid #333; }
        .opf-web-card .opf-web-head h1 { margin:0; text-align:center; font-size:19px; line-height:24px; font-weight:bold; text-transform:uppercase; }
        .opf-web-card .opf-web-logo { display:flex; align-items:center; padding-left:26px; }
        .opf-web-card .opf-web-logo img { height:100px; width:auto; max-width:200px; object-fit:contain; }
        .opf-web-card .opf-web-metawrap { border-bottom:1px solid #333; }
        .opf-web-card .opf-web-meta { display:grid; grid-template-columns:repeat(5,16.9%); margin-left:8.33%; min-height:57px; padding:11px 0 12px; }
        .opf-web-card .opf-web-meta div { font-size:12px; line-height:18px; font-weight:bold; padding-right:8px; }
        .opf-web-card .opf-web-title { margin:28px 0 5px; font-size:13px; line-height:16px; font-weight:bold; }
        .opf-web-card .opf-web-table { width:100%; border-collapse:collapse; }
        .opf-web-card .opf-web-table th, .opf-web-card .opf-web-table td { border:1px solid #333; padding:6px 7px; text-align:left; vertical-align:top; font-size:12px; line-height:17px; color:#555; background:#fafafa; }
        .opf-web-card .opf-web-table th { font-weight:bold; color:#212121; background:#fff; }
        .opf-web-card .opf-web-table .opf-total td { font-weight:bold; }
        .opf-web-card .opf-web-table b { font-weight:normal; }
        .opf-web-card .opf-web-table td div { font-size:12px; line-height:17px; }
        .opf-web-card .opf-web-details { margin-top:10px; padding-left:4px; }
        .opf-web-card .opf-web-details div { font-size:13.5px; line-height:18.7px; color:#212121; }
        .opf-web-card .opf-web-actions { display:flex; justify-content:center; gap:4px; margin-top:48px; }
        .opf-web-card .opf-web-actions button { display:inline-flex; align-items:center; gap:4px; padding:5px 12px; border:none; border-radius:2px; color:#fff; font-size:12px; font-weight:bold; line-height:16px; cursor:pointer; }
        .opf-web-card .opf-web-actions .opf-web-edit { background:#ff9800; }
        .opf-web-card .opf-web-actions .opf-web-send { background:#3f51b5; }
        @layer base {
          .opf-web-card .opf-web-head h1 { font-size:19px !important; }
          .opf-web-card .opf-web-meta div { font-size:12px !important; }
          .opf-web-card .opf-web-title { font-size:13px !important; }
          .opf-web-card .opf-web-table th, .opf-web-card .opf-web-table td, .opf-web-card .opf-web-table td div { font-size:12px !important; }
          .opf-web-card .opf-web-details div { font-size:13.5px !important; }
          .opf-web-card .opf-web-actions button { font-size:12px !important; }
        }
      `}</style>
  )

  if (showPage) return (
    <div className="px-1 py-2">
      {styles}
      <div className="opf-web-card">
        <div className="opf-web-head"><h1>Order Processing Format</h1><div className="opf-web-logo">{logoUrl && <img src={logoUrl} alt="Company logo" />}</div></div>
        <div className="opf-web-metawrap"><div className="opf-web-meta">
          <div>Quot No: {opf.quotationNumber || quotation?.quotationId || ''}</div>
          <div>PO No: {opf.customerPONo || ''}</div>
          <div>OPF No: {opf.opfNo || ''}</div>
          <div>Date: {formatDate(opf.createdDate)}</div>
          <div>Created By Sales Rep: {opf.createdBy || ''}</div>
        </div></div>
        <OPFTable web title="Customer Details" nameLabel="Customer Name" name={customerName || ''} product={product || ''} description={description || ''} partNo={opf.partNo || ''} quantity={quantityDisplay} unitPrice={opf.unitPrice} tax={opf.tax} subtotal={customerSubtotal} gst={customerGST} total={customerTotal} />
        <OPFTable web title="Vendor/Supplier Details" nameLabel="Vendor Name" name={opf.supplierName || ''} supplierContactPerson={opf.supplierContactPerson} product={product || ''} description={description || ''} partNo={opf.partNo || ''} quantity={quantityDisplay} unitPrice={opf.vendorPrice} tax={opf.tax} subtotal={vendorSubtotal} gst={vendorGST} total={vendorTotal} vendor startDate={opf.startDate} endDate={opf.endDate} gp={gp} gpPercentage={gpPercentage} />
        <div className="opf-web-details">{detailRows.map(([label, value]) => <div key={label}>{label}: {value || ''}</div>)}</div>
        <div className="opf-web-actions">
          <button type="button" className="opf-web-edit" onClick={() => navigate(`/sales/opf/edit/${id}`)}><Pencil size={12} /> EDIT</button>
          <button type="button" className="opf-web-send" onClick={() => window.open(`/sales/opf/${id}`, '_blank')}>View &amp; Send PDF</button>
        </div>
      </div>
      {toast && <Toast message={toast} type={toast.includes('success') ? 'success' : 'error'} onClose={() => setToast(null)} />}
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center">
      {styles}
      <div className="flex items-center gap-3 text-gray-700" role="status">
        <Loader className="h-5 w-5 animate-spin" />
        Generating PDF...
      </div>
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 0 }}>{documentNode}</div>
    </div>
  )
}

type OPFTableProps = {
  title: string
  nameLabel: string
  name: string
  supplierContactPerson?: string
  product: string
  description: string
  partNo: string
  quantity: number | string
  unitPrice?: number | string
  tax?: string
  subtotal: number
  gst: ReturnType<typeof calculateGST>
  total: number
  vendor?: boolean
  web?: boolean
  startDate?: string
  endDate?: string
  gp?: number
  gpPercentage?: number
}

function OPFTable({ title, nameLabel, name, supplierContactPerson, product, description, partNo, quantity, unitPrice, tax, subtotal, gst, total, vendor, web, startDate, endDate, gp = 0, gpPercentage = 0 }: OPFTableProps) {
  const halfTax = taxDetails(tax).percentage / 2
  return (
    <>
      <div className={web ? 'opf-web-title' : 'opf-title'}>{title}</div>
      <table className={web ? 'opf-web-table' : 'opf-table'}>
        {!web && (
          <colgroup>
            <col style={{ width: '5%' }} />
            <col style={{ width: '9.9%' }} />
            <col style={{ width: '10.1%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '5.9%' }} />
            <col style={{ width: '6.2%' }} />
            <col style={{ width: '9.2%' }} />
            <col style={{ width: '9.8%' }} />
            <col style={{ width: '7.9%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '12%' }} />
          </colgroup>
        )}
        <thead>
          <tr>
          <th>Sl. No.</th>
          <th>{nameLabel}</th>
          <th>Product</th>
          <th>Description</th>
          <th>Part No.</th>
          <th>Qty</th>
          <th>Unit<br />Price(INR)</th>
          <th>Sub Total(INR)</th>
          <th colSpan={2}>{web ? 'GST' : 'GST (INR)'}</th>
          <th>Total Price(INR)</th>
        </tr>
        </thead>
        <tbody>
        <tr>
          <td>1</td>
          <td>
            {name}
            {vendor && supplierContactPerson && <><br /><b>Contact :</b><br />{supplierContactPerson}</>}
          </td>
          <td>{product}</td>
          <td>
            {description}
            {vendor && startDate && <><br /><b>Start :</b><br />{startDate.slice(0, 10)} to {endDate?.slice(0, 10) || ''}</>}
          </td>
          <td>{partNo}</td>
          <td>{quantity}</td>
          <td>{formatAmount(unitPrice)}</td>
          <td>{formatAmount(subtotal)}</td>
          <td>
            <div>CGST {halfTax}%</div>
            <div className="opf-dash">-----------</div>
            <div>{formatAmount(gst.cgst)}</div>
          </td>
          <td>
            <div>SGST {halfTax}%</div>
            <div className="opf-dash">-----------</div>
            <div>{formatAmount(gst.sgst)}</div>
          </td>
          <td>{formatAmount(total)}</td>
        </tr>
        <tr className="opf-total">
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td colSpan={2}>Grand Total</td>
          <td>{formatAmount(subtotal)}</td>
          <td colSpan={2}>{formatAmount(gst.totalGST)}</td>
          <td>{formatAmount(total)}</td>
        </tr>
        {vendor && (
          <>
            <tr className="opf-total">
              <td></td><td></td><td></td><td></td><td></td>
              <td colSpan={3}></td>
              <td colSpan={2}>GP</td>
              <td>{formatAmount(gp)}</td>
            </tr>
            <tr className="opf-total">
              <td></td><td></td><td></td><td></td><td></td>
              <td colSpan={3}></td>
              <td colSpan={2}>GP %</td>
              <td>{gpPercentage.toFixed(2)}</td>
            </tr>
          </>
        )}
        </tbody>
      </table>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div><b>{label}:</b> {value || ''}</div>
}