'use client'

import { useState } from 'react'
import QuotationDashboardPage from '@/sales/pages/QuotationDashboardPage'

type QuotationType = 'rent' | 'sold'

export default function QuotationTypeSelectPage() {
  const [selectedType, setSelectedType] = useState<QuotationType>('rent')

  return (
    <QuotationDashboardPage
      quotationTypeOverride={selectedType}
      embedded
      tabs={
        <div
          role="tablist"
          aria-label="Quotation type"
          className="flex w-fit items-center gap-2 rounded-xl border border-[#E7E3DA] bg-[#F2EFE8] p-1.5"
        >
          {(['rent', 'sold'] as const).map((type) => {
            const isSelected = selectedType === type
            return (
              <button
                key={type}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedType(type)}
                className={`min-w-24 rounded-lg border px-5 py-2.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CEC9BD] ${
                  isSelected
                    ? 'border-[#17233B] bg-[#17233B] font-semibold text-white shadow-sm'
                    : 'border-[#E7E3DA] bg-white/70 font-medium text-[#1F2937] hover:border-[#CEC9BD] hover:bg-white hover:shadow-sm'
                }`}
              >
                {type === 'rent' ? 'Rent' : 'Sold'}
              </button>
            )
          })}
        </div>
      }
    />
  )
}
