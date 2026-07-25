import { Monitor } from 'lucide-react'

interface InventoryItemProps {
  id: string
  name: string
  specs: string
  categories: string[]
  available: number
  total: number
  rented: number
  utilization: number
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
}

export function InventoryItem({
  id,
  name,
  specs,
  categories,
  available,
  total,
  rented,
  utilization,
  status,
}: InventoryItemProps) {
  const statusColor = {
    HEALTHY: 'bg-green-50 text-green-700',
    WARNING: 'bg-yellow-50 text-yellow-700',
    CRITICAL: 'bg-red-50 text-red-700',
  }

  const barColor = {
    HEALTHY: 'bg-green-500',
    WARNING: 'bg-yellow-500',
    CRITICAL: 'bg-red-500',
  }

  return (
    <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 bg-[#F2EFE8] rounded-lg flex items-center justify-center flex-shrink-0">
          <Monitor className="w-6 h-6 text-gray-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-serif font-bold text-gray-900">{name}</h3>
          <p className="text-sm text-gray-600">{specs}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {categories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-1 bg-[#F2EFE8] text-gray-700 text-xs font-medium rounded"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-[#F2EFE8]">
        <div>
          <div className="text-2xl font-bold text-gray-900">{available}</div>
          <div className="text-xs text-gray-500 mt-1">of {total} available</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">{rented} rented</div>
        </div>
        <div className="text-right">
          <div className={`px-2 py-1 rounded text-xs font-semibold inline-block ${statusColor[status]}`}>
            {status}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600">Utilization</span>
          <span className="text-gray-600">{utilization}% utilised</span>
        </div>
        <div className="w-full bg-[#F2EFE8] rounded-full h-2">
          <div
            className={`h-2 rounded-full ${barColor[status]}`}
            style={{ width: `${utilization}%` }}
          />
        </div>
      </div>
    </div>
  )
}
