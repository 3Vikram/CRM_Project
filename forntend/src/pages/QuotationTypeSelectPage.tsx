'use client'

import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Building2, Building } from 'lucide-react'

const options = [
  {
    key: 'rent',
    title: 'Rent',
    description: 'Create rent quotations for equipment or rental work.',
    icon: Building2,
  },
  {
    key: 'sold',
    title: 'Sold',
    description: 'Create sale quotations for direct product sales.',
    icon: Building,
  },
] as const

export default function QuotationTypeSelectPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-heading">Quotation</h1>
        {/* <p className="mt-2 text-sm text-gray-600">Select the quotation category to continue.</p> */}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {options.map(({ key, title, description, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(`/sales/quotations/${key}`, { state: { quotationType: key } })}
            className="group rounded-2xl border border-[#EFECE5] bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2EFE8] text-[#111827]">
              <Icon className="h-6 w-6" />
            </div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
              <ArrowRightLeft className="h-5 w-5 text-gray-500 transition group-hover:translate-x-1 group-hover:-translate-y-0.5" />
            </div>
            <p className="text-sm leading-6 text-gray-600">{description}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
