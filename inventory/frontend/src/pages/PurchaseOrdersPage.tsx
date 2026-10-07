'use client'

import { useState } from 'react'
import { Search, FileText } from 'lucide-react'

const purchaseOrders = [
  { id: 'PO-2025-001', vendor: 'Dell Technologies', amount: '₹25,00,000', status: 'Pending', items: 50 },
  { id: 'PO-2025-002', vendor: 'HP India', amount: '₹18,50,000', status: 'Approved', items: 35 },
  { id: 'PO-2025-003', vendor: 'Lenovo India', amount: '₹12,00,000', status: 'Delivered', items: 40 },
  { id: 'PO-2025-004', vendor: 'Apple Authorized', amount: '₹8,75,000', status: 'Pending', items: 25 },
  { id: 'PO-2025-005', vendor: 'ASUS Distribution', amount: '₹5,50,000', status: 'Approved', items: 20 },
]

const statusColors = {
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Approved': 'bg-blue-100 text-blue-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700',
}

export default function PurchaseOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredOrders = purchaseOrders.filter(
    (order) =>
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.vendor.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          Purchase Orders
        </h1>
        <p className="text-gray-600">
          Manage and track all vendor orders in one place.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by PO ID or vendor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EFECE5] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
        />
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg border border-[#EFECE5] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#EFECE5] bg-[#F2EFE8]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                PO ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-[#F2EFE8] hover:bg-[#F2EFE8] cursor-pointer transition-colors">
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.id}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{order.vendor}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{order.amount}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{order.items} units</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[order.status as keyof typeof statusColors]}`}>
                    {order.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
