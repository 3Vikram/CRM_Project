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

const formatCurrency = (value: unknown): string => {
  const numericValue = safeNumber(value)
  if (numericValue === 0) return '₹0'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue)
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
  const [quotation, setQuotation] = useState<LeadRecord | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfileRecord | null>(null)
  const [customer, setCustomer] = useState<CustomerApiRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const printRef = useRef<HTMLDivElement | null>(null)

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
          onClick={() => navigate('/sales/quotations')}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Quotations
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
    navigate('/sales/quotations')
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

  const termsList = [
    { label: 'Taxes & Duties', value: 'All Inclusive.' },
    { label: 'Payment Terms', value: paymentValue },
    { label: 'Order Cancellation', value: 'Orders once placed cannot be cancelled under any circumstances.' },
    { label: 'Total in Words', value: totalInWords },
    { label: 'Purchase Order', value: 'PO to be placed in the name of Synov IT Services Pvt Ltd, Bangalore.' },
    { label: 'Delivery', value: `Within ${deliveryValue} from the date of receipt of PO.` },
    { label: 'Quote Validity', value: `This quote is valid for ${validityValue} days only. Orders received beyond quote validity will not be accepted.` },
    { label: 'Prices quoted', value: 'Prices quoted are exclusive of any additional charges unless mentioned explicitly.' },
    { label: 'Licenses/Subscription', value: 'Synov IT Services Pvt Ltd will only liaise between customer and OEM /Vendor and is responsible only to deliver licenses/subscription as per quote provided. License/Subscription EULA as per OEM/Vendor.' },
    { label: 'Support', value: 'As per OEM/Vendor terms unless mentioned specifically.' },
    { label: 'Courier charges', value: 'Courier charges should be borne by the client if the delivery location is outside Bengaluru.' },
    { label: 'Implementation & Training', value: 'The prices quoted do not include Implementation, Training or any other professional services unless mentioned specifically.' },
  ]

  return (
    <div className="bg-white text-black" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
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
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 194mm !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            box-shadow: none !important;
            max-width: 194mm !important;
            overflow: visible !important;
          }

          .quotation-view-shell > div {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            box-sizing: border-box !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
          }

          .quotation-view-shell table {
            width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            box-sizing: border-box !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          .quotation-products-table {
            width: 100% !important;
            max-width: 100% !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }

          .quotation-view-shell th,
          .quotation-view-shell td {
            max-width: 0 !important;
            box-sizing: border-box !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            white-space: normal !important;
          }

          .quotation-view-shell thead {
            display: table-header-group !important;
          }

          .quotation-view-shell tr,
          .quotation-view-shell .quotation-branding-block,
          .quotation-view-shell .quotation-footer {
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .quotation-view-shell tbody tr {
            break-inside: auto;
            page-break-inside: auto;
          }

          .quotation-branding-block {
            position: static !important;
            display: block !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
          }

          .quotation-footer {
            position: static !important;
            display: block !important;
            margin: auto 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
          }

          .quotation-footer div {
            page-break-inside: auto !important;
            break-inside: auto !important;
            height: auto !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-[860px] px-4 py-4 sm:px-6 lg:px-8">
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

        <div ref={printRef} className="quotation-view-shell mx-auto max-w-[820px]">
          <div className="border border-[#111111] bg-white p-1.5 md:p-2" style={{ borderRadius: 0, boxShadow: 'none' }}>
            <div className="mt-4 grid grid-cols-[1fr_auto] items-start gap-3 leading-tight">
            <div className="text-[12px] font-bold text-black">
              <div className="flex gap-2">
                <span className="w-[62px] font-semibold">Date</span>
                <span>:</span>
                <span>{formatDate(quotation.createdDate)}</span>
              </div>
              <div className="mt-0.5 flex gap-2">
                <span className="w-[62px] font-semibold">Ref No</span>
                <span>:</span>
                <span>{referenceNo}</span>
              </div>
              <div className="mt-0.5 flex gap-2">
                <span className="w-[62px] font-semibold">GSTIN/UIN</span>
                <span>:</span>
                <span>{companyProfile?.gstNo || '—'}</span>
              </div>
            </div>

            <div className="flex items-start justify-end">
              {companyLogoUrl ? (
                <img
                  src={companyLogoUrl}
                  alt={companyProfile?.companyName || 'Company logo'}
                  className="-mt-5 h-[110px] w-auto max-w-[300px] object-contain"
                />
              ) : null}
            </div>
          </div>

          <div className="-mt-5 text-center">
            <h1 className="m-0 text-[28px] font-bold uppercase text-black underline decoration-[1.5px] underline-offset-4 md:text-[31px]" style={{ letterSpacing: 'normal' }}>
              QUOTATION
            </h1>
          </div>

          <div className="mt-2 text-[12px] text-black">
            <div className="mb-1 font-bold uppercase">To,</div>
            <div className="leading-snug">
              <div>{quotation.contactPerson || '—'}</div>
              <div>{quotation.companyName || '—'}</div>
              {customer?.billToAddress?.city && <div>{customer.billToAddress.city}</div>}
            </div>
          </div>

          <div className="mt-2 text-[12px] text-black">
            <span className="font-bold">Subject:</span>
            <span className="font-bold ml-1 uppercase">{subject}</span>
          </div>

          <div className="mt-2 text-[12px] leading-relaxed text-black">
            <div>Dear Sir/Madam,</div>
            <div className="mt-1">We are pleased to send our best quote for the following products enquired.</div>
          </div>

         {/* <div className="mt-2 overflow-hidden" style={{ border: '0.3px solid #000000' }}> */}
         <div className="quotation-products-table mt-2 overflow-hidden">
            <table className="w-full text-[10px] text-black" style={{ fontFamily: '"Times New Roman", Times, serif', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '5%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '6%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '15%' }} />
              </colgroup>
              <thead>
                <tr style={{ height: '22px' }}>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '5%', border: '0.3px solid #000000' }}>SL.<br />No.</th>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '15%', border: '0.3px solid #000000' }}>Product</th>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '25%', border: '0.3px solid #000000' }}>Description</th>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '6%', border: '0.3px solid #000000' }}>Qty</th>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '11%', border: '0.3px solid #000000' }}>Unit<br />Price(INR)</th>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '11%', border: '0.3px solid #000000' }}>Sub<br />Total(INR)</th>
                  <th colSpan={2} className="px-1 py-1 text-center font-bold align-middle" style={{ width: '14%', border: '0.3px solid #000000' }}>GST (INR)</th>
                  <th className="px-1 py-1 text-center font-bold align-middle" style={{ width: '13%', border: '0.3px solid #000000' }}>Total<br />Price(INR)</th>
                </tr>
                {/* <tr style={{ height: '16px' }}>
                  <th colSpan={6} style={{ backgroundColor: '#ffffff', border: '0.3px solid #000000', padding: 0 }} />
                  <th className="px-0.5 py-0 text-center font-bold align-middle text-[9px]" style={{ width: '7%', border: '0.3px solid #000000' }}>CGST<br />9%</th>
                  <th className="px-0.5 py-0 text-center font-bold align-middle text-[9px]" style={{ width: '7%', border: '0.3px solid #000000' }}>SGST<br />9%</th>
                  <th style={{ backgroundColor: '#ffffff', border: '0.3px solid #000000', padding: 0 }} />
                </tr> */}
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

                    return (
                      <tr key={`${product.productName || 'product'}-${index}`} style={{ height: 'auto' }}>
                        <td className="px-1 py-1 text-center align-top" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{index + 1}</td>
                        <td className="px-1 py-1 text-left align-top" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{product.productName || '—'}</td>
                        <td className="px-1 py-1 text-left align-top" style={{ border: '0.3px solid #000000', wordWrap: 'break-word', verticalAlign: 'top', whiteSpace: 'normal' }}>{product.productDescription || '—'}</td>
                        <td className="px-1 py-1 text-center align-top" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{safeNumber(product.quantity)}</td>
                        <td className="px-1 py-1 text-right align-top" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{formatCurrency(product.unitPrice)}</td>
                        <td className="px-1 py-1 text-right align-top" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{formatCurrency(subtotal)}</td>
                        {/* <td className="px-1 py-1 text-right align-top text-[9px]" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{formatCurrency(cgst)}</td>
                        <td className="px-1 py-1 text-right align-top text-[9px]" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{formatCurrency(sgst)}</td> */}
                        <td
  className="px-1 py-1 text-center align-top text-[9px]"
  style={{
    border: '0.3px solid #000000',
    verticalAlign: 'top',
  }}
>
  <div className="font-bold">CGST 9%</div>
  <div
    style={{
      borderTop: '1px dashed #b5b5b5',
      margin: '4px 8px',
    }}
  />
  <div>{formatCurrency(cgst)}</div>
</td>

<td
  className="px-1 py-1 text-center align-top text-[9px]"
  style={{
    border: '0.3px solid #000000',
    verticalAlign: 'top',
  }}
>
  <div className="font-bold">SGST 9%</div>
  <div
    style={{
      borderTop: '1px dashed #b5b5b5',
      margin: '4px 8px',
    }}
  />
  <div>{formatCurrency(sgst)}</div>
</td>
                        <td className="px-1 py-1 text-right align-top" style={{ border: '0.3px solid #000000', verticalAlign: 'top' }}>{formatCurrency(total)}</td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="px-1 py-2 text-center text-slate-600" style={{ border: '0.3px solid #000000' }}>
                      No products added.
                    </td>
                  </tr>
                )}

                <tr style={{ height: '18px', fontWeight: 'bold' }}>
                  <td colSpan={5} className="px-1 py-1 text-right align-middle" style={{ border: '0.3px solid #000000', fontWeight: 'bold' }}>Grand Total</td>
                  <td className="px-1 py-1 text-right align-middle" style={{ border: '0.3px solid #000000', fontWeight: 'bold' }}>{formatCurrency(subtotalTotal)}</td>
                  <td colSpan={2} className="px-1 py-1 text-center align-middle" style={{ border: '0.3px solid #000000', fontWeight: 'bold' }}>{formatCurrency(totalCGST + totalSGST)}</td>
                  <td className="px-1 py-1 text-right align-middle" style={{ border: '0.3px solid #000000', fontWeight: 'bold' }}>{formatCurrency(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

<div
  className="mt-3 text-[12px] text-black"
  style={{
    fontFamily: '"Times New Roman", Times, serif',
    lineHeight: '1.3',
  }}
>
  <div
    style={{
      fontWeight: 'bold',
      marginBottom: '3px',
    }}
  >
    Terms &amp; Conditions:
  </div>

  <ol
    style={{
      listStyleType: 'decimal',
      listStylePosition: 'outside',
      paddingLeft: '18px',
      margin: 0,
    }}
  >
    {termsList.map((term, index) => (
      <li
        key={`${term.label}-${index}`}
        style={{
          margin: 0,
          padding: 0,
          lineHeight: '1.3',
          fontWeight: 'normal',
        }}
      >
        <span style={{ fontWeight: 'normal' }}>
          {term.label}:
        </span>{' '}
        <span style={{ fontWeight: 'normal' }}>
          {term.value}
        </span>
      </li>
    ))}
  </ol>
</div>

          <div
  className="mt-4 leading-tight text-black"
  style={{
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: '12px',
  }}
>
  <p className="m-0">
    Please do not hesitate to contact me in case of any clarifications.
  </p>

  <p className="mt-3 mb-0">
    Thank you for giving us opportunity to serve you. Looking forward to your valuable order.
  </p>

  <div className="mt-3">
    <div className="font-bold text-black">
      From {companyProfile?.companyName || 'Synov IT Services Pvt Ltd'}
    </div>

    <div className="mt-1">
      {quotation.createdBy || 'Authorized person / Created By'}
    </div>

    <div className="mt-1">
      Phone: {companyProfile?.companyContactNo || '—'}
    </div>
  </div>
</div>

          <div className="quotation-branding-block">
            {partnerLogoUrl && (
              <div className="mt-0 flex justify-center pt-4">
                <img
                  src={partnerLogoUrl}
                  alt="Company partner logo"
                  className="h-[75px] w-auto max-w-full object-contain md:h-[180px]"
                />
              </div>
            )}

            <div className="quotation-footer mt-4 border-t border-[#2b2b2b] pt-3 text-center text-[11px] text-black">
              <div className="font-bold text-black">{companyProfile?.companyName || 'Company Name'}</div>
              <div className="mt-1">
                {companyProfile?.address || ''}
                {companyProfile?.city ? `, ${companyProfile.city}` : ''}
                {companyProfile?.state ? `, ${companyProfile.state}` : ''}
                {companyProfile?.pin ? ` - ${companyProfile.pin}` : ''}
              </div>
              <div className="mt-1">
                {companyProfile?.companyContactNo ? `Phone: ${companyProfile.companyContactNo}` : ''}
                {companyProfile?.email ? ` | Email: ${companyProfile.email}` : ''}
                {companyProfile?.website ? ` | Website: ${companyProfile.website}` : ''}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
