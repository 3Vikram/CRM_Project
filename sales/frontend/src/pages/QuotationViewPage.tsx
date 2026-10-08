"use client"

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, Edit2, Loader, Mail, Printer } from 'lucide-react'
import html2pdf from 'html2pdf.js'
import { fetchLeadById, type LeadRecord, sendQuotationPdf } from '@/lib/leadApi'
import { fetchCompanyProfiles, type CompanyProfileRecord } from '@/lib/companyProfileApi'
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi'
import { Toast } from '@/components/toast'

const safeNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

const parseTaxPercent = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0
  const match = String(value).match(/(\d+(?:\.\d+)?)/)
  if (!match) return 0
  return safeNumber(match[1])
}

const formatAmount = (value: unknown): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value))
}

const formatDate = (date?: string | null): string => {
  if (!date) return '-'
  try {
    return new Date(date).toLocaleDateString('en-GB')
  } catch {
    return '-'
  }
}

const resolveImageUrl = (filePath?: string) => {
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) return filePath
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api$/, '')
  return `${base}${filePath}`
}

const convertBelow100 = (value: number): string => {
  const ones = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  if (value < 20) return ones[value]

  const tensDigit = Math.floor(value / 10)
  const onesDigit = value % 10
  return onesDigit === 0 ? tens[tensDigit] : `${tens[tensDigit]} ${ones[onesDigit]}`
}

const convertBelow1000 = (value: number): string => {
  if (value < 100) return convertBelow100(value)

  const hundreds = Math.floor(value / 100)
  const remainder = value % 100
  const hundredsText = `${convertBelow100(hundreds)} Hundred`

  if (remainder === 0) return hundredsText
  if (remainder < 100) return `${hundredsText} and ${convertBelow100(remainder)}`
  return `${hundredsText} ${convertBelow100(remainder)}`
}

const numberToIndianWords = (value: number): string => {
  if (!Number.isFinite(value)) return 'Zero'

  const absoluteValue = Math.round(Math.abs(value))
  if (absoluteValue === 0) return 'Zero'

  const crore = Math.floor(absoluteValue / 10000000)
  const lakh = Math.floor((absoluteValue % 10000000) / 100000)
  const thousand = Math.floor((absoluteValue % 100000) / 1000)
  const remainder = absoluteValue % 1000

  const parts: string[] = []

  if (crore > 0) parts.push(`${convertBelow1000(crore)} Crore`)
  if (lakh > 0) parts.push(`${convertBelow1000(lakh)} Lakh`)
  if (thousand > 0) parts.push(`${convertBelow1000(thousand)} Thousand`)
  if (remainder > 0) parts.push(convertBelow1000(remainder))

  return parts.join(' ')
}

export default function QuotationViewPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isPdfTab = new URLSearchParams(window.location.search).get('openPdf') === '1'
  const [quotation, setQuotation] = useState<LeadRecord | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileRecord | null>(null)
  const [customer, setCustomer] = useState<CustomerApiRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [returnType, setReturnType] = useState<'rent' | 'sold'>('rent')
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [isGeneratingBrowserPdf, setIsGeneratingBrowserPdf] = useState(isPdfTab)
  const printRef = useRef<HTMLDivElement | null>(null)
  const hasStartedPdfTab = useRef(false)

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        setError('Quotation ID not found')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const quotationData = await fetchLeadById(id)
        if (!quotationData) {
          setError('Quotation not found')
          setIsLoading(false)
          return
        }

        setQuotation(quotationData)
        setReturnType(quotationData.quotationType === 'sold' ? 'sold' : 'rent')

        const profileResponse = await fetchCompanyProfiles({ limit: 1 })
        if (profileResponse.data && profileResponse.data.length > 0) {
          setCompanyProfile(profileResponse.data[0])
        }

        // Fetch customer data by company name
        if (quotationData.companyName) {
          try {
            const customerResponse = await fetchCustomers({ search: quotationData.companyName, limit: 1 })
            if (customerResponse.data && customerResponse.data.length > 0) {
              setCustomer(customerResponse.data[0])
            }
          } catch (customerErr) {
            // If customer fetch fails, continue without customer data
            console.warn('Failed to fetch customer data:', customerErr)
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load quotation')
      } finally {
        setIsLoading(false)
      }
    }

    void loadData()
  }, [id])

  useEffect(() => {
    if (!isPdfTab || isLoading || !quotation || !printRef.current || hasStartedPdfTab.current) return

    hasStartedPdfTab.current = true
    const quotationElement = printRef.current
    const openGeneratedPdf = async () => {
      try {
        const pdfUrl = await new Promise<string>((resolve, reject) => {
          html2pdf()
            .set({
              margin: [0, 0, 0, 0],
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: {
                scale: 2,
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: '#ffffff',
              },
              jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
              },
            })
            .from(quotationElement)
            .toPdf()
            .get('pdf')
            .then((pdf: any) => resolve(URL.createObjectURL(pdf.output('blob'))))
            .catch(reject)
        })

        window.location.replace(pdfUrl)
      } catch (pdfError) {
        setIsGeneratingBrowserPdf(false)
        setError(pdfError instanceof Error ? pdfError.message : 'Unable to generate quotation PDF.')
        hasStartedPdfTab.current = false
      }
    }

    void openGeneratedPdf()
  }, [isLoading, isPdfTab, quotation])

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-7 w-7 animate-spin text-[#2563EB]" />
          <p className="text-sm text-slate-600">Loading quotation...</p>
        </div>
      </div>
    )
  }

  if (error || !quotation) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(`/sales/quotations/${returnType}`)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {returnType === 'sold' ? 'Sold' : 'Rent'} Quotations
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'Quotation not found'}
        </div>
      </div>
    )
  }

  const products = quotation.products || []
  const referenceNo = quotation.quotationId || '—'
  const subject = quotation.quotationDetails?.subject || '—'
  const location = quotation.quotationDetails?.delivery || companyProfile?.city || ''

  const handleBack = () => {
    navigate(`/sales/quotations/${returnType}`)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadPdf = async () => {
    if (!printRef.current) return

    const generatedFileName = `quotation-${referenceNo || 'document'}.pdf`

    await html2pdf()
      .set({
        margin: [0, 0, 0, 0],
        filename: generatedFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: '#ffffff',
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
      })
      .from(printRef.current)
      .save()
  }

  const handleViewAndSendPdf = async () => {
    if (!printRef.current || !id) {
      setToast('Unable to generate PDF. Please try again.')
      return
    }

    setIsSendingEmail(true)
    try {
      // Generate PDF as data URL (base64)
      const pdfDataUrl = await new Promise<string>((resolve, reject) => {
        html2pdf()
          .set({
            margin: [0, 0, 0, 0],
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
              scale: 2,
              useCORS: true,
              scrollX: 0,
              scrollY: 0,
              backgroundColor: '#ffffff',
            },
            jsPDF: {
              unit: 'mm',
              format: 'a4',
              orientation: 'portrait',
            },
          })
          .from(printRef.current!)
          .toPdf()
          .get('pdf')
          .then((pdf: any) => {
            // Get PDF as data URL string (includes "data:application/pdf;base64," prefix)
            const dataUrl = pdf.output('dataurlstring')
            resolve(dataUrl)
          })
          .catch((err: any) => {
            reject(err)
          })
      })

      // Get recipient email from localStorage
      const recipientEmail = window.localStorage.getItem('userEmail') || ''

      if (!recipientEmail) {
        setToast('User email not found. Please set your email in profile settings.')
        setIsSendingEmail(false)
        return
      }

      // Send PDF to backend
      const response = await sendQuotationPdf(id, pdfDataUrl, recipientEmail)

      if (response.success) {
        setToast('Quotation PDF sent successfully to ' + recipientEmail)
      } else {
        setToast(response.message || 'Failed to send quotation PDF')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate or send PDF'
      setToast(errorMessage)
      console.error('PDF send error:', err)
    } finally {
      setIsSendingEmail(false)
    }
  }

  const handleEdit = () => {
    navigate(`/sales/quotations/edit/${id}`)
  }

  const getProductSubtotal = (product: { quantity?: string | number; unitPrice?: string | number }) => {
    return safeNumber(product.quantity) * safeNumber(product.unitPrice)
  }

  const getProductTaxAmount = (product: { quantity?: string | number; unitPrice?: string | number; tax?: string | number }) => {
    const subtotal = getProductSubtotal(product)
    const taxPercent = parseTaxPercent(product.tax)
    return (subtotal * taxPercent) / 100
  }

  const getTaxBreakdown = (taxValue?: string | number) => {
    const taxPercent = parseTaxPercent(taxValue)
    const taxString = String(taxValue ?? '').toLowerCase()

    if (taxString.includes('igst')) {
      return {
        leftLabel: `IGST`,
        leftRate: taxPercent,
        rightLabel: `IGST`,
        rightRate: taxPercent,
      }
    }

    const cgstRate = taxPercent / 2
    return {
      leftLabel: `CGST`,
      leftRate: cgstRate,
      rightLabel: `SGST`,
      rightRate: cgstRate,
    }
  }

  const subtotalTotal = products.reduce((sum, product) => sum + getProductSubtotal(product), 0)
  const totalCGST = products.reduce((sum, product) => {
    const subtotal = getProductSubtotal(product)
    const taxPercent = parseTaxPercent(product.tax)
    const cgstRate = taxPercent / 2
    return sum + (subtotal * cgstRate) / 100
  }, 0)
  const totalSGST = products.reduce((sum, product) => {
    const subtotal = getProductSubtotal(product)
    const taxPercent = parseTaxPercent(product.tax)
    const sgstRate = taxPercent / 2
    return sum + (subtotal * sgstRate) / 100
  }, 0)
  const totalTax = totalCGST + totalSGST
  const grandTotal = subtotalTotal + totalTax
  const totalInWords = `${numberToIndianWords(Math.round(grandTotal))} rupee Only.`
  const companyLogoUrl = resolveImageUrl(companyProfile?.companyLogo?.filePath)
  const partnerLogoUrl = resolveImageUrl(
    companyProfile?.documentFooter?.filePath || companyProfile?.documentLogo?.filePath || companyProfile?.companyLogo?.filePath
  )
  const deliveryValue = quotation.quotationDetails?.delivery || 'Delivery schedule will be as mutually agreed.'
  const validityValue = quotation.quotationDetails?.validity || '30'
  const paymentValue = quotation.quotationDetails?.payment || 'Payment terms as agreed between both parties.'

  const termsList: { label?: string; value: string }[] = [
    { label: 'Taxes & Duties', value: 'All Inclusive.' },
    { label: 'Payment Terms', value: paymentValue },
    { label: 'Order Cancellation', value: 'Orders once placed cannot be cancelled under any circumstances.' },
    { label: 'Total in Words', value: totalInWords },
    { label: 'Purchase Order', value: 'PO to be placed in the name of Synov IT Services Pvt Ltd, Bangalore.' },
    { label: 'Delivery', value: `Within ${deliveryValue} from the date of receipt of PO.` },
    { label: 'Quote Validity', value: `This quote is valid for ${validityValue} days only. Orders received beyond quote validity will not be accepted.` },
    { value: 'Prices quoted are as per quantity mentioned. Any changes in quantity, prices will change accordingly.' },
    { label: 'Licenses/Subscription', value: 'Synov IT Services Pvt Ltd will only liaise between customer and OEM /Vendor and is responsible only to deliver licenses/subscription as per quote provided. License/Subscription EULA as per OEM/Vendor.' },
    { label: 'Support', value: 'As per OEM/Vendor terms unless mentioned specifically.' },
    { value: 'Courier charges should be borne by the client if the delivery location is outside Bengaluru.' },
    { label: 'Implementation & Training', value: 'The prices quoted do not include Implementation, Training or any other professional services unless mentioned specifically.' },
  ]

  return (
    <div className="quotation-preview-page min-h-full bg-[#e5e5e5] text-black">
      {isGeneratingBrowserPdf && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-white text-sm text-slate-700" role="status">
          Preparing quotation PDF...
        </div>
      )}
      <style>{`
        .quotation-view-shell {
          width: 100%;
          max-width: 794px;
          margin: 0 auto;
          padding: 20px;
          box-sizing: border-box;
          background: #ffffff;
          color: #000000;
          font-family: "Times New Roman", Times, serif;
        }
        .quotation-frame {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #000000;
          background: #ffffff;
          color: #000000;
        }
        .quotation-view-shell .quotation-frame * {
          box-sizing: border-box;
          color: #000000 !important;
          font-family: "Times New Roman", Times, serif !important;
          font-size: 12px !important;
          font-weight: normal !important;
          line-height: 15px !important;
        }
        .quotation-header {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          padding: 5px 6px 4px;
        }
        .quotation-header-meta,
        .quotation-view-shell .quotation-frame .quotation-header-meta * {
          font-size: 13.33px !important;
          font-weight: bold !important;
          line-height: 17px !important;
        }
        .quotation-view-shell .quotation-frame .quotation-header-title {
          align-self: end;
          margin: 0;
          font-size: 24px !important;
          font-weight: bold !important;
          line-height: 29px !important;
          text-align: center;
          text-decoration: underline;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .quotation-logo {
          justify-self: end;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .quotation-logo img {
          display: block;
          width: auto;
          height: 90px;
          object-fit: contain;
        }
        .quotation-section {
          padding: 0 6px;
        }
        .quotation-view-shell .quotation-frame .quotation-subject {
          margin-top: 15px;
          font-weight: bold !important;
        }
        .quotation-view-shell .quotation-frame .quotation-subject * {
          font-weight: bold !important;
        }
        .quotation-introduction {
          margin-top: 15px;
        }
        .quotation-products-table {
          width: calc(100% + 2px);
          margin: 21px 0 0 -1px;
          overflow: visible;
        }
        .q-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }
        .q-table th,
        .q-table td {
          border: none;
          border-right: 1px solid #000000;
          border-bottom: 1px solid #000000;
          padding: 7px 4px;
          font-size: 10.67px !important;
          line-height: 13px !important;
          text-align: center;
          vertical-align: middle;
        }
        .q-table thead th {
          border-top: 1px solid #000000;
        }
        .quotation-view-shell .quotation-frame .quotation-products-table th {
          font-weight: bold !important;
        }
        .quotation-view-shell .quotation-frame .quotation-products-table td.quotation-description-cell {
          padding: 7px 10px !important;
        }
        .q-table tr > *:last-child {
          border-right: none;
        }
        .quotation-view-shell .quotation-frame .quotation-tax-line {
          display: block;
          line-height: 13px !important;
        }
        .quotation-view-shell .quotation-frame .quotation-tax-separator {
          color: #555555 !important;
        }
        .quotation-view-shell .quotation-frame .quotation-grand-total td,
        .quotation-view-shell .quotation-frame .quotation-grand-total td * {
          font-weight: bold !important;
        }
        .quotation-terms {
          margin-top: 21px;
          padding: 0 6px;
        }
        .quotation-view-shell .quotation-frame .quotation-terms-heading {
          font-weight: bold !important;
        }
        .quotation-term {
          font-weight: normal !important;
        }
        .quotation-closing {
          margin-top: 15px;
          padding: 0 6px;
        }
        .quotation-closing p {
          margin: 0;
          font-weight: normal !important;
        }
        .quotation-closing p + p {
          margin-top: 15px;
        }
        .quotation-signoff {
          margin-top: 15px;
        }
        .quotation-signoff div {
          margin: 0;
          font-weight: normal !important;
        }
        .quotation-partner-logo {
          display: flex;
          justify-content: center;
          margin-top: 28px;
        }
        .quotation-partner-logo img {
          display: block;
          width: 97%;
          height: auto;
        }
        .quotation-footer-rule {
          width: 79%;
          margin: 4px auto 22px;
          border-top: 1px solid #2b2b2b;
        }
        .quotation-footer {
          padding: 0 6px 16px;
          text-align: center;
          font-size: 12px !important;
          line-height: 15px !important;
        }
        .quotation-footer > div {
          font-size: 12px !important;
          line-height: 15px !important;
        }
        @layer base {
          .quotation-view-shell .quotation-frame * { font-size: 12px !important; }
          .quotation-view-shell .q-meta div { font-size: 13.33px !important; }
          .quotation-view-shell .q-title { font-size: 24px !important; }
          .quotation-view-shell .q-table th,
          .quotation-view-shell .q-table td,
          .quotation-view-shell .q-table * { font-size: 10.67px !important; }
        }
        @media (max-width: 720px) {
          .quotation-products-table {
            overflow-x: auto;
          }
          .q-table {
            min-width: 690px;
          }
        }
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .quotation-view-shell,
          .quotation-view-shell * {
            visibility: visible !important;
          }
          html,
          body,
          #root {
            margin: 0 !important;
            padding: 0 !important;
            width: auto !important;
            height: auto !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
            background: #ffffff !important;
            display: block !important;
          }
          .quotation-actions {
            display: none !important;
          }
          .quotation-view-shell {
            width: 100% !important;
            max-width: 194mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .quotation-products-table {
            overflow: visible !important;
          }
          .q-table {
            min-width: 0 !important;
          }
          .quotation-products-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        <div className="quotation-actions mb-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleEdit}
            disabled={isSendingEmail}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Edit2 className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => void handleViewAndSendPdf()}
            disabled={isSendingEmail}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            {isSendingEmail ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                View & Send PDF
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={isSendingEmail}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>

        {toast && (
          <Toast
            message={toast}
            onClose={() => setToast(null)}
            type={toast.includes('successfully') ? 'success' : 'error'}
          />
        )}

        <div ref={printRef} className="quotation-view-shell">
          <div className="quotation-frame">
            <div className="quotation-header">
              <div className="quotation-header-meta">
                <div>Date: {formatDate(quotation.createdDate)}</div>
                <div>Ref No: {referenceNo}</div>
                <div>GSTIN/UIN: {companyProfile?.gstNo || '—'}</div>
              </div>

              <h1 className="quotation-header-title">QUOTATION</h1>

              <div className="quotation-logo">
                {companyLogoUrl ? (
                  <img src={companyLogoUrl} alt={companyProfile?.companyName || 'Company logo'} />
                ) : null}
              </div>
            </div>

            <div className="quotation-section quotation-recipient">
              <div>To,</div>
              <div>{quotation.contactPerson || '—'}</div>
              <div>{quotation.companyName || '—'}</div>
              {(() => {
                const addressParts = [
                  customer?.billToAddress?.addressLine1,
                  customer?.billToAddress?.area,
                  customer?.billToAddress?.city,
                  customer?.billToAddress?.state,
                  customer?.billToAddress?.pincode,
                  customer?.billToAddress?.country,
                ].filter(Boolean)

                return addressParts.length > 0 ? <div>{addressParts.join(', ')}</div> : null
              })()}
            </div>

            <div className="quotation-section quotation-introduction">
              <div>Dear Sir/Madam,</div>
              <div>We are pleased to send our best quote for the following products enquired.</div>
            </div>

            <div className="quotation-products-table">
              <table className="q-table">
                <colgroup>
                  <col style={{ width: '5%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '5.5%' }} />
                  <col style={{ width: '11.5%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10.5%' }} />
                  <col style={{ width: '10.5%' }} />
                  <col style={{ width: '12%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Sl.<br />No.</th>
                    <th>Product</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit<br />Price(INR)</th>
                    <th>Sub<br />Total(INR)</th>
                    <th colSpan={2}>GST (INR)</th>
                    <th>Total<br />Price(INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length > 0 ? (
                    products.map((product, index) => {
                      const subtotal = getProductSubtotal(product)
                      const taxPercent = parseTaxPercent(product.tax)
                      const cgstRate = taxPercent / 2
                      const sgstRate = taxPercent / 2
                      const cgst = (subtotal * cgstRate) / 100
                      const sgst = (subtotal * sgstRate) / 100
                      const total = subtotal + cgst + sgst
                      const taxBreakdown = getTaxBreakdown(product.tax)
                      const leftTaxValue = taxBreakdown.leftLabel.toLowerCase().includes('igst') ? (subtotal * taxPercent) / 100 : cgst
                      const rightTaxValue = taxBreakdown.rightLabel.toLowerCase().includes('igst') ? 0 : sgst

                      return (
                        <tr key={`${product.productName || 'product'}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{product.productName || '—'}</td>
                          <td className="quotation-description-cell">{product.productDescription || '—'}</td>
                          <td>{safeNumber(product.quantity)}</td>
                          <td>{formatAmount(product.unitPrice)}</td>
                          <td>{formatAmount(subtotal)}</td>
                          <td>
                            <div className="quotation-tax-line">{taxBreakdown.leftLabel} {taxBreakdown.leftRate ? `${taxBreakdown.leftRate}%` : ''}</div>
                            <div className="quotation-tax-line quotation-tax-separator">-----------</div>
                            <div className="quotation-tax-line">{formatAmount(leftTaxValue)}</div>
                          </td>
                          <td>
                            <div className="quotation-tax-line">{taxBreakdown.rightLabel} {taxBreakdown.rightRate ? `${taxBreakdown.rightRate}%` : ''}</div>
                            <div className="quotation-tax-line quotation-tax-separator">-----------</div>
                            <div className="quotation-tax-line">{formatAmount(rightTaxValue)}</div>
                          </td>
                          <td>{formatAmount(total)}</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={9}>No products added.</td>
                    </tr>
                  )}

                  <tr className="quotation-grand-total">
                    <td></td>
                    <td></td>
                    <td></td>
                    <td colSpan={2}>Grand Total</td>
                    <td>{formatAmount(subtotalTotal)}</td>
                    <td colSpan={2}>{formatAmount(totalCGST + totalSGST)}</td>
                    <td>{formatAmount(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="quotation-terms">
              <div className="quotation-terms-heading">Terms &amp; Conditions:</div>
              {termsList.map((term, index) => (
                <div className="quotation-term" key={`${term.label || term.value}-${index}`}>
                  {index + 1}. {term.label ? `${term.label}: ` : ''}{term.value}
                </div>
              ))}
            </div>

            <div className="quotation-closing">
              <p>Please do not hesitate to contact me in case of any clarifications.</p>
              <p>Thank you for giving us opportunity to serve you. Looking forward to your valuable order.</p>
              <div className="quotation-signoff">
                <div>From {companyProfile?.companyName || 'Synov IT Services Pvt Ltd'}</div>
                <div>{quotation.createdBy || 'Authorized person / Created By'}</div>
                <div>Phone: {companyProfile?.companyContactNo || '—'}</div>
              </div>
            </div>

            {partnerLogoUrl && (
              <div className="quotation-partner-logo">
                <img src={partnerLogoUrl} alt="Company partner logo" />
              </div>
            )}

            <div className="quotation-footer-rule" />
            <div className="quotation-footer">
              <div>
                {(() => {
                  const addressParts = [companyProfile?.address, companyProfile?.city, companyProfile?.state].filter(Boolean)
                  const address = addressParts.join(', ')
                  return [address, companyProfile?.pin].filter(Boolean).join(' ')
                })()}
              </div>
              <div>
                {[
                  companyProfile?.companyContactNo ? `Ph: ${companyProfile.companyContactNo}` : '',
                  companyProfile?.email ? `Email: ${companyProfile.email}` : '',
                  companyProfile?.website ? `URL: ${companyProfile.website}` : '',
                ].filter(Boolean).join(', ')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
