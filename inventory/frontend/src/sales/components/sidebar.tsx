'use client'

import { Link, useLocation } from 'react-router-dom'
import {
  Activity,
  Building2,
  Contact,
  FileText,
  LayoutDashboard,
  Mail,
  Package,
  Package2,
  Users,
  UserCheck,
  Zap,
} from 'lucide-react'
import { hasPermission } from '@/sales/lib/permissions'

interface SidebarProps {
  isExpanded: boolean
  isMobileOpen: boolean
  onToggle: () => void
  onClose: () => void
}

export function Sidebar({ isExpanded, isMobileOpen, onToggle, onClose }: SidebarProps) {
  const { pathname } = useLocation()
  const showLabels = isExpanded || isMobileOpen
  const menuItems = [
    { href: '/sales/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard' },
    { href: '/sales/contacts', label: 'Contact', icon: Contact, permission: 'contacts' },
    { href: '/sales/mail-campaign', label: 'Mail Campaign', icon: Mail, permission: 'mailCampaign' },
    { href: '/sales/leads', label: 'Lead', icon: Zap, permission: 'leads' },
    { href: '/sales/activities', label: 'Activity', icon: Activity, permission: 'activities' },
    { href: '/sales/calendar', label: 'Calendar', icon: Package2, permission: 'calendar' },
    { href: '/sales/customers', label: 'Customer', icon: Users, permission: 'customers' },
    { href: '/sales/customer-mapping', label: 'Customer Mapping', icon: UserCheck, permission: 'customerMapping' },
    { href: '/sales/quotations', label: 'Quotation', icon: FileText, permission: 'quotations' },
    { href: '/sales/suppliers', label: 'Supplier', icon: Package2, permission: 'suppliers' },
    { href: '/sales/funnels', label: 'Funnel', icon: Users, permission: 'funnels' },
    { href: '/sales/opf', label: 'OPF', icon: Building2, permission: 'opf' },
    { href: '/sales/renewals', label: 'Renewals', icon: Package2, permission: 'renewals' },
    { href: '/reports', label: 'Reports', icon: LayoutDashboard, permission: 'reports' },
    { href: '/sales/data-admin', label: 'Data Admin', icon: Package, permission: 'dataAdmin' },
    { href: '/sales/employees', label: 'Employees', icon: Users, permission: 'employees' },
    { href: '/sales/company-profiles', label: 'Company Profiles', icon: Building2, permission: 'companyProfiles' },
    // { href: '/sales/inventory', label: 'Inventory', icon: Package, permission: 'inventory' },
    // { href: '/sales/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, permission: 'purchaseOrders' },
    // { href: '/sales/dc-tracking', label: 'DC Tracking', icon: Truck, permission: 'dcTracking' },
    // { href: '/sales/bill-sale', label: 'Bill Sale', icon: FileText, permission: 'billSale' },
  ]

  return (
    <>
      {isMobileOpen ? <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-slate-950/50 md:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex h-[calc(100vh/var(--sales-ui-scale))] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#17233B] text-slate-200 shadow-xl transition-all duration-200 md:relative md:inset-y-auto md:z-auto md:shadow-none ${isMobileOpen ? 'w-60 translate-x-0' : '-translate-x-full md:translate-x-0'} ${isExpanded ? 'md:w-60' : 'md:w-[72px]'}`}>
        <div className="relative flex h-[72px] shrink-0 items-center justify-center border-b border-white/10 px-3">
          <Link
            to="/sales/dashboard"
            className={`select-none text-center ${showLabels ? 'text-[30px]! tracking-[0.16em] pl-[0.22em]' : 'text-[28px]! tracking-normal'} font-bold uppercase text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
          >
            {showLabels ? 'SYNOV' : 'S'}
          </Link>
          <button type="button" onClick={onToggle} aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'} className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:inline-flex">
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
        <div className={`px-4 pt-5 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 ${showLabels ? 'opacity-100' : 'sr-only'}`}>Sales</div>
        <nav aria-label="Sales navigation" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-4 [scrollbar-color:#475569_transparent] [scrollbar-width:thin]">
          {menuItems.filter((item) => hasPermission(item.permission)).map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                title={!showLabels ? item.label : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-[#EDE7F6] text-[#17233B] shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className={showLabels ? 'truncate' : 'sr-only md:hidden'}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
