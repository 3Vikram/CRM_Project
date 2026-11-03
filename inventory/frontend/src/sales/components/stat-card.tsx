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
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  iconBg = 'bg-[#F2EFE8]',
  iconColor = 'text-gray-700',
  labelClassName = '',
}: StatCardProps) {
  return (
    <div className="sales-summary-card flex h-full items-center gap-3">
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