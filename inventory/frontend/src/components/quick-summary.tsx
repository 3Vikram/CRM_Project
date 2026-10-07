'use client'

import { ArrowDown, ArrowUp, Clock, AlertTriangle, ArrowRight } from 'lucide-react'

export interface QuickSummaryItem {
  label: string
  value: string | number
  icon: React.ReactNode
  onClick?: () => void
}

interface QuickSummaryProps {
  items: QuickSummaryItem[]
}

export function QuickSummary({ items }: QuickSummaryProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-[#E7E3DD] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={item.onClick}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-[#F7F6F3] rounded-xl flex items-center justify-center">
              {item.icon}
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900 mb-2">{item.value}</div>
          <div className="text-sm text-gray-600 font-medium mb-3">{item.label}</div>
          <button className="inline-flex items-center gap-1 text-sm text-[#0B1F33] font-semibold hover:gap-2 transition-all">
            View details
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  )
}
