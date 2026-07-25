'use client'

import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Zap,
  Package,
  ShoppingCart,
  Truck,
  FileText,
} from 'lucide-react'

export function Sidebar() {
  const { pathname } = useLocation()

  const menuItems = [
    { href: '/sales/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/sales/customers', label: 'Customers', icon: Users },
    { href: '/sales/leads', label: 'Leads', icon: Zap },
    { href: '/sales/inventory', label: 'Inventory', icon: Package },
    { href: '/sales/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart },
    { href: '/sales/dc-tracking', label: 'DC Tracking', icon: Truck },
    { href: '/sales/bill-sale', label: 'Bill / Sale', icon: FileText },
  ]

  return (
    <div className="w-56 bg-[#F0EEE7] border-r border-[#E7E3DA] flex flex-col h-screen fixed left-0 top-0">
      {/* Logo Section */}
      <div className="p-6 border-b border-[#E7E3DA]">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">3V</span>
          </div>
          <div>
            <div className="font-serif font-bold text-gray-900">3Vikram</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Sales · Technologies</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-6">
          <div className="text-xs font-semibold text-gray-400 uppercase px-3 mb-4 tracking-wider">
            Workspace
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-black/5'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>

      {/* TIP Section */}
      <div className="p-4 m-3 bg-black/[0.02] border border-[#E7E3DA] rounded-lg">
        <div className="text-xs font-semibold text-gray-600 uppercase mb-2 tracking-wider">
          Tip
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          New to 3Vikram? Click any card to see full details — no page jumps.
        </p>
      </div>
    </div>
  )
}
