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
import synovLogo from '../assets.png'
import { hasPermission } from '@/sales/lib/permissions'

interface SidebarProps {
  isExpanded: boolean
  isMobileOpen: boolean
  onToggle?: () => void
  onClose: () => void
  onDesktopHoverEnter: () => void
  onDesktopHoverLeave: () => void
}

export function Sidebar({
  isExpanded,
  isMobileOpen,
  onClose,
  onDesktopHoverEnter,
  onDesktopHoverLeave,
}: SidebarProps) {
  const { pathname } = useLocation()
  const showLabels = isExpanded || isMobileOpen
  const handleMouseEnter = () => {
    if (window.matchMedia('(min-width: 768px)').matches) onDesktopHoverEnter()
  }
  const handleMouseLeave = () => {
    if (window.matchMedia('(min-width: 768px)').matches) onDesktopHoverLeave()
  }
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
      <aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#17233B] text-slate-200 shadow-xl transition-[width,transform] duration-[250ms] ease-in-out md:relative md:inset-y-auto md:z-auto md:shadow-none ${isMobileOpen ? 'w-[176px] translate-x-0' : '-translate-x-full md:translate-x-0'} ${isExpanded ? 'md:w-[176px]' : 'md:w-[72px]'}`}
      >
        <div className="relative flex h-[72px] shrink-0 items-center justify-center border-b border-white/10 px-3">
          <Link
            to="/sales/dashboard"
            className={`select-none text-center ${showLabels ? 'text-[26px]! tracking-[0.16em] pl-[0.22em]' : 'text-[24px]! tracking-normal'} font-bold uppercase text-white no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
          >
            {showLabels ? 'SYNOV' : <img src={synovLogo} alt="SYNOV company logo" className="h-12 w-12 object-contain" />}
          </Link>
        </div>
        <div
          aria-hidden={!showLabels}
          className={`flex w-full min-w-0 shrink-0 items-center overflow-hidden px-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 transition-[height,opacity] duration-[200ms] ${
            showLabels ? 'h-10 opacity-100' : 'h-0 opacity-0'
          }`}
        >
          <span className="block min-w-0 truncate">Sales</span>
        </div>
        <nav aria-label="Sales navigation" className="min-h-0 flex-1 space-y-0 overflow-y-auto px-2 py-2 [scrollbar-color:#475569_transparent] [scrollbar-width:thin]">
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
                className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${showLabels ? 'justify-start' : 'md:justify-center'} ${isActive ? 'bg-[#EDE7F6] text-[#17233B] shadow-sm' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-[200ms] ${showLabels ? 'max-w-[140px] opacity-100' : 'max-w-0 opacity-0'}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
