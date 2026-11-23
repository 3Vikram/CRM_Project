'use client'

import { useNavigate } from 'react-router-dom'
import { ArrowRightLeft, Building2, Building, Plus } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="crm-page-heading">Quotation</h1>
        <PermissionGate moduleName="quotations" action="create">
          <button type="button" onClick={() => navigate('/sales/quotations/new/rent')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#111827] px-4 text-sm font-medium text-white transition hover:bg-[#1E293B]">
            <Plus className="h-4 w-4" /> ADD NEW
          </button>
        </PermissionGate>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quotation type">
        {options.map(({ key, title, description, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => navigate(`/sales/quotations/${key}`, { state: { quotationType: key } })}
            title={description}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-[#F2EFE8]"
          >
            <Icon className="h-4 w-4" />
            {title}
            <ArrowRightLeft className="h-4 w-4 text-gray-500" />
          </button>
        ))}
      </div>
    </div>
  )
}
