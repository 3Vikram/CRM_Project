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
  labelClassName?: string
  onClick?: () => void
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  iconBg = 'bg-[#F2EFE8]',
  iconColor = 'text-gray-700',
  labelClassName = '',
  onClick,
}: StatCardProps) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      } : undefined}
      className={`sales-summary-card flex h-full items-center gap-3 ${onClick ? 'cursor-pointer transition-shadow duration-150 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827]' : ''}`}
    >
      <div className={`sales-summary-card-icon ${iconBg}`}>
        <Icon className={`${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="sales-summary-card-value">{value}</div>
        <div className={`sales-summary-card-label stat-card-label ${labelClassName}`}>
          {label}
        </div>
        {description && <p className="sales-summary-card-description mt-0.5 truncate">{description}</p>}
      </div>
    </div>
  )
}