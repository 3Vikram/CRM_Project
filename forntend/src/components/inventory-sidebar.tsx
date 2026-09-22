'use client'

import { Link, useLocation } from 'react-router-dom'
import {
  Package,
  BoxesIcon,
  ChevronDown,
  Home,
  Truck,
  RotateCcw,
  Mail,
  Calculator,
} from 'lucide-react'
import { Inventory2Outlined } from '@mui/icons-material'
import { useState } from 'react'

export function InventorySidebar() {
  const { pathname } = useLocation()
  const [expandedSections, setExpandedSections] = useState<string[]>(['INVENTORY'])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    )
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const sections = [
    {
      title: 'INVENTORY',
      items: [
        { href: '/inventory', label: 'Overview', icon: Home },
        { href: '/inventory/assets', label: 'All Assets', icon: Package },
        { href: '/inventory/in-stock', label: 'In Stock', icon: BoxesIcon },
        { href: '/inventory/out-stock', label: 'Out Stock', icon: Package },
        { href: '/inventory/returned-assets', label: 'Returned', icon: RotateCcw },
        { href: '/inventory/products', label: 'Products', icon: Inventory2Outlined },
      ],
    },
    {
      title: 'SETTINGS',
      items: [
        { href: '/inventory/daily-email', label: 'Daily Email', icon: Mail },
        { href: '/inventory/depreciation-history', label: 'Depreciation History', icon: Calculator },
        { href: '/inventory/accessories', label: 'Accessories', icon: Package },
      ],
    },
  ]

  return (
    <div className="w-60 bg-[#06283D] border-r border-[#0F4A63] flex flex-col h-screen fixed left-0 top-0 text-white">
      <div className="p-6 border-b border-[#0F4A63]">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full border border-white/15 bg-white/10 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">3V</span>
          </div>
          <div>
            <div className="font-semibold text-sm tracking-[0.16em] text-white">3 VIKRAM</div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-slate-300">Inventory</div>
          </div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.title} className="px-3 py-3">
            <button
              onClick={() => toggleSection(section.title)}
              className="flex items-center justify-between w-full px-3 mb-2 text-[11px] font-semibold text-slate-300 uppercase tracking-[0.24em] hover:text-white transition-colors"
            >
              <span>{section.title}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${expandedSections.includes(section.title) ? 'rotate-180' : ''}`} />
            </button>
            {expandedSections.includes(section.title) && (
              <nav className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        active
                          ? 'bg-[#124B68] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                          : 'text-slate-300 hover:text-white hover:bg-[#0B3A53]'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
