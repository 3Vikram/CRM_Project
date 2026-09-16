'use client'

import { AlertCircle, ArrowRight } from 'lucide-react'
import { EmptyState } from './empty-state'

export interface LowStockItem {
  id: string
  asset: string
  available: number
  minStock: number
  status: 'LOW' | 'CRITICAL'
}

interface LowStockAlertsProps {
  items: LowStockItem[]
  isLoading?: boolean
}

export function LowStockAlerts({ items, isLoading }: LowStockAlertsProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LOW':
        return 'bg-[#D99A00] text-white'
      case 'CRITICAL':
        return 'bg-[#D64545] text-white'
      default:
        return 'bg-gray-200 text-gray-800'
    }
  }

  if (items.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E3DD] p-6 shadow-sm h-full">
        <div className="flex items-center gap-2 mb-6">
          <AlertCircle className="w-5 h-5 text-[#198754]" />
          <h3 className="text-lg font-bold text-gray-900">Low Stock Alerts</h3>
        </div>
        <EmptyState
          icon={<AlertCircle className="w-12 h-12 mx-auto text-gray-300" />}
          title="No low stock alerts."
          description="Low stock items will appear here once they exist in MongoDB."
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3DD] p-6 shadow-sm h-full">
      <div className="flex items-center gap-2 mb-6">
        <AlertCircle className="w-5 h-5 text-[#D64545]" />
        <h3 className="text-lg font-bold text-gray-900">Low Stock Alerts</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E7E3DD]">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Asset
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Available
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Min. Stock
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`border-b border-[#F7F6F3] hover:bg-[#F7F6F3] transition-colors ${
                  idx === items.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <td className="py-4 px-4">
                  <div className="font-medium text-gray-900">{item.asset}</div>
                </td>
                <td className="py-4 px-4">
                  <div className="text-gray-600 font-semibold">{item.available}</div>
                </td>
                <td className="py-4 px-4">
                  <div className="text-gray-600">{item.minStock}</div>
                </td>
                <td className="py-4 px-4">
                  <span className={`inline-block px-3 py-1.5 rounded-lg font-semibold text-xs ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#E7E3DD]">
          <button className="inline-flex items-center gap-2 text-[#0B1F33] font-semibold hover:gap-3 transition-all">
            View low stock report
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
