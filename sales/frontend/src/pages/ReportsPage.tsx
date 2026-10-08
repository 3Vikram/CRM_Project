'use client'

import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleDollarSign,
  Package,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const reportOptions = [
  { label: 'Revenue & Margin', path: '/reports/revenue-margin', icon: CircleDollarSign },
  { label: 'Top 10 Customers', path: '/reports/top-customers', icon: Users },
  { label: 'Top 10 Employees', path: '/reports/top-employees', icon: BriefcaseBusiness },
  { label: 'Top 10 Products', path: '/reports/top-products', icon: Package },
  { label: 'Usages Reports', path: '/reports/usage', icon: BarChart3 },
  { label: 'Funnel Analysis Reports', path: '/reports/funnel-analysis', icon: Target },
  { label: 'Team Analysis Reports', path: '/reports/team-analysis', icon: ShieldCheck },
  { label: 'Product Analysis Reports', path: '/reports/product-analysis', icon: ChartNoAxesCombined },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-heading">Reports</h1>
        {/* <p className="mt-1 text-sm text-[#6B6657]">Choose a report to open its workspace.</p> */}
      </div>

      <nav aria-label="Reports" className="max-w-3xl space-y-2">
        {reportOptions.map(({ label, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="group flex items-center justify-between rounded-lg border border-[#EFECE5] bg-white px-5 py-4 text-[#1F1D1A] shadow-sm transition hover:border-[#CEC9BD] hover:bg-[#FDFCF9]"
          >
            <span className="flex items-center gap-3 text-sm font-semibold">
              <Icon className="h-5 w-5 text-[#6B6657]" />
              {label}
            </span>
            <ArrowRight className="h-4 w-4 text-[#9A9487] transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </nav>
    </div>
  )
}
