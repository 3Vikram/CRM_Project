'use client'

import { Link } from 'react-router-dom'
import { ShoppingCart, Package, Calculator, ArrowRight } from 'lucide-react'

const modules = [
  {
    key: 'sales',
    label: 'Sales',
    description:
      'Manage customers, leads, rentals, purchase orders, DC tracking and bills — all in one workspace.',
    icon: ShoppingCart,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-700',
    to: '/sales/dashboard',
    accent: 'ring-emerald-200 hover:ring-emerald-300',
  },
  {
    key: 'inventory',
    label: 'Inventory',
    description:
      'Track your fleet, stock levels, utilisation and movements across warehouses.',
    icon: Package,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    to: '/inventory',
    accent: 'ring-amber-200 hover:ring-amber-300',
  },
  {
    key: 'accounts',
    label: 'Accounts',
    description:
      'Invoices, payments, outstanding balances and financial reporting.',
    icon: Calculator,
    iconBg: 'bg-rose-100',
    iconColor: 'text-rose-700',
    to: '/accounts',
    accent: 'ring-rose-200 hover:ring-rose-300',
  },
]

export default function ModuleSelectPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-16">
      {/* Brand */}
      <div className="flex flex-col items-center mb-12">
        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center mb-4">
          <span className="text-white font-bold text-base">3V</span>
        </div>
        <h1 className="text-5xl font-serif font-bold text-gray-900 mb-3">
          3Vikram Technologies
        </h1>
        <p className="text-gray-600 max-w-xl text-center">
          Choose a workspace to begin. Each module keeps its tools where you need them.
        </p>
      </div>

      {/* Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.key}
              to={m.to}
              className={`group bg-white rounded-2xl border border-[#EFECE5] shadow-sm p-8 ring-1 ring-transparent transition-all hover:shadow-md ${m.accent}`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${m.iconBg}`}
              >
                <Icon className={`w-7 h-7 ${m.iconColor}`} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-gray-900 mb-2">
                {m.label}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-8">
                {m.description}
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                Open module
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}