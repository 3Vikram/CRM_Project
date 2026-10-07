import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  /** Pastel background tile for the icon, e.g. "bg-emerald-100" */
  iconBg?: string
  /** Icon color, e.g. "text-emerald-700" */
  iconColor?: string
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  iconBg = 'bg-[#F2EFE8]',
  iconColor = 'text-gray-700',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {label}
          </div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          {description && (
            <p className="text-xs text-gray-600 mt-1">{description}</p>
          )}
        </div>
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}
        >
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  )
}