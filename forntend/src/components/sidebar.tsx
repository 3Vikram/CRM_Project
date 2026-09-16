'use client'

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Contact,
  Package2,
  Zap,
  Mail,
  Package,
  Activity,
  ShoppingCart,
  Truck,
  FileText,
  Building2,
} from 'lucide-react'

export function Sidebar() {
  const { pathname } = useLocation()
  const [isExpanded, setIsExpanded] = useState(false)

  const menuItems = [
    { href: '/sales/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sales/contacts', label: 'Contact', icon: Contact },
    { href: '/sales/mail-campaign', label: 'Mail Campaign', icon: Mail },
    { href: '/sales/leads', label: 'Lead', icon: Zap },
    { href: '/sales/activities', label: 'Activity', icon: Activity },
    { href: '/sales/calendar', label: 'Calendar', icon: Package2 },
    { href: '/sales/customers', label: 'Customer', icon: Users },
    { href: '/sales/quotations', label: 'Quotation', icon: FileText },
    { href: '/sales/suppliers', label: 'Supplier', icon: Package2 },
    { href: '/sales/funnels', label: 'Funnel', icon: Users },
    { href: '/sales/opf', label: 'OPF', icon: Building2 },
    { href: '/sales/renewals', label: 'Renewals', icon: Package2 },
    { href: '/sales/reports', label: 'Report', icon: LayoutDashboard },
    { href: '/sales/data-admin', label: 'Data Admin', icon: Package },
    { href: '/sales/employees', label: 'Employees', icon: Users },
    { href: '/sales/company-profiles', label: 'Company Profiles', icon: Building2 },
  ]

  return (
    <div
      className={`flex h-full flex-col overflow-hidden border-r border-[#E7E3DA] bg-[#F0EEE7] transition-[width] duration-300 ease-in-out shrink-0 ${
        isExpanded ? 'w-60' : 'w-[72px]'
      }`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Navigation */}
      <div className="flex-1 overflow-hidden">
        <div className="px-2 py-6">
          <div className={`mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-[#6B6657] transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
            SALES
          </div>
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200 ${
                    isActive
                      ? 'bg-[#F7F5F2] text-[#1F1D1A]'
                      : 'text-[#6B6657] hover:bg-[#E7E3DA] hover:text-[#1F1D1A]'
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? 'text-[#1F1D1A]' : 'text-[#6B6657]'}`} />
                  <span className={`text-sm transition-all duration-300 ${isExpanded ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0 overflow-hidden'}`}>
                    {item.label}
                  </span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      
    </div>
  )
}
