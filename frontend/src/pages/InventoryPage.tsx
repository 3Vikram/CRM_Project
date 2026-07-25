'use client'

import { useState } from 'react'
import { StatCard } from '@/components/stat-card'
import { InventoryItem } from '@/components/inventory-item'
import { Package, Search } from 'lucide-react'

const inventoryItems = [
  {
    id: '1',
    name: 'Dell OptiPlex 7010',
    specs: 'i5 · 16GB · 512GB SSD',
    categories: ['DESKTOP', 'OFFICE'],
    available: 36,
    total: 120,
    rented: 84,
    utilization: 70,
    status: 'HEALTHY' as const,
  },
  {
    id: '2',
    name: 'HP Z2 Workstation G9',
    specs: 'Xeon · 32GB · 1TB NVMe',
    categories: ['WORKSTATION', 'DESIGN'],
    available: 18,
    total: 40,
    rented: 22,
    utilization: 55,
    status: 'HEALTHY' as const,
  },
  {
    id: '3',
    name: 'Lenovo ThinkCentre M70',
    specs: 'i7 · 16GB · 512GB SSD',
    categories: ['DESKTOP', 'OFFICE'],
    available: 19,
    total: 80,
    rented: 61,
    utilization: 76,
    status: 'HEALTHY' as const,
  },
  {
    id: '4',
    name: 'Apple iMac 24" (M3)',
    specs: 'M3 · 8GB · 256GB SSD',
    categories: ['DESKTOP', 'DESIGN'],
    available: 12,
    total: 30,
    rented: 18,
    utilization: 60,
    status: 'HEALTHY' as const,
  },
]

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = inventoryItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.specs.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    totalFleet: 270,
    rentedOut: 185,
    availableNow: 85,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          Inventory
        </h1>
        <p className="text-gray-600">
          What&apos;s on the shelf. What&apos;s in the field.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard
          icon={Package}
          label="Total Fleet"
          value={stats.totalFleet}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon={Package}
          label="Rented Out"
          value={stats.rentedOut}
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
        />
        <StatCard
          icon={Package}
          label="Available Now"
          value={stats.availableNow}
          iconBg="bg-green-100"
          iconColor="text-green-700"
        />
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search model, specs or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EFECE5] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
        />
      </div>

      {/* Inventory List */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <InventoryItem key={item.id} {...item} />
        ))}
      </div>
    </div>
  )
}
