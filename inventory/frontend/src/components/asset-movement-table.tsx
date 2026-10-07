'use client'

import { ArrowDownCircle, ArrowUpCircle, Truck, RotateCcw, ShoppingCart, AlertCircle, ArrowRight } from 'lucide-react'
import { EmptyState } from './empty-state'

export interface AssetMovement {
  id: string
  asset: string
  type: 'INWARD' | 'OUTWARD' | 'RENT_OUT' | 'RETURNED' | 'SOLD' | 'SOLD_OUT'
  quantity: number
  date: string
  by: string
}

interface AssetMovementTableProps {
  movements: AssetMovement[]
  isLoading?: boolean
}

const TypeConfig = {
  INWARD: {
    icon: ArrowDownCircle,
    label: 'INWARD',
    badge: 'bg-[#198754] text-white',
    color: 'text-[#198754]',
  },
  OUTWARD: {
    icon: ArrowUpCircle,
    label: 'OUTWARD',
    badge: 'bg-[#D99A00] text-white',
    color: 'text-[#D99A00]',
  },
  RENT_OUT: {
    icon: Truck,
    label: 'RENT OUT',
    badge: 'bg-blue-500 text-white',
    color: 'text-blue-500',
  },
  RETURNED: {
    icon: RotateCcw,
    label: 'RETURNED',
    badge: 'bg-purple-500 text-white',
    color: 'text-purple-500',
  },
  SOLD: {
    icon: ShoppingCart,
    label: 'SOLD',
    badge: 'bg-[#D64545] text-white',
    color: 'text-[#D64545]',
  },
  SOLD_OUT: {
    icon: ShoppingCart,
    label: 'SOLD OUT',
    badge: 'bg-[#D64545] text-white',
    color: 'text-[#D64545]',
  },
}

export function AssetMovementTable({ movements, isLoading }: AssetMovementTableProps) {
  if (movements.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-[#E7E3DD] p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Asset Movement</h3>
        <EmptyState
          icon={<AlertCircle className="w-12 h-12 mx-auto text-gray-300" />}
          title="No recent asset movements."
          description="Recent inward, outward, rental, and return activity will appear here once it exists in MongoDB."
        />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-[#E7E3DD] p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900">Recent Asset Movement</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E7E3DD]">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Asset
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Type
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Quantity
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                Date
              </th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-4 px-4">
                By
              </th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement, idx) => {
              const config = TypeConfig[movement.type]
              const Icon = config.icon
              return (
                <tr
                  key={movement.id}
                  className={`border-b border-[#F7F6F3] hover:bg-[#F7F6F3] transition-colors ${
                    idx === movements.length - 1 ? 'border-b-0' : ''
                  }`}
                >
                  <td className="py-4 px-4">
                    <div className="font-medium text-gray-900">{movement.asset}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-sm ${config.badge}`}>
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className={`font-bold text-sm ${movement.quantity > 0 ? 'text-[#198754]' : 'text-[#D64545]'}`}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-gray-600">{movement.date}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-sm text-gray-600">{movement.by}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {movements.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[#E7E3DD]">
          <button className="inline-flex items-center gap-2 text-[#0B1F33] font-semibold hover:gap-3 transition-all">
            View complete movement history
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
