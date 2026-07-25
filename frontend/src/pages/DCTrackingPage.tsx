'use client'

import { useState } from 'react'
import { Search, Truck } from 'lucide-react'

const dcs = [
  { id: 'DC-OUT-3313', type: 'OUT', customer: 'Coral Media Labs', product: 'HP Z2 Workstation × 4', date: '2025-01-15', status: 'Dispatched' },
  { id: 'DC-IN-2202', type: 'IN', customer: 'Saffron Retail', product: 'Dell OptiPlex 7010 × 10', date: '2025-01-14', status: 'Overdue' },
  { id: 'DC-OUT-3312', type: 'OUT', customer: 'Nimbus Analytics', product: 'Lenovo ThinkCentre × 20', date: '2025-01-10', status: 'Delivered' },
  { id: 'DC-IN-2201', type: 'IN', customer: 'Fernwood Studios', product: 'Apple iMac × 5', date: '2025-01-08', status: 'Received' },
  { id: 'DC-OUT-3311', type: 'OUT', customer: 'Orbit Consulting', product: 'HP Z2 Workstation × 2', date: '2025-01-05', status: 'Delivered' },
]

const statusColors = {
  'Dispatched': 'bg-blue-100 text-blue-700',
  'In Transit': 'bg-yellow-100 text-yellow-700',
  'Delivered': 'bg-green-100 text-green-700',
  'Received': 'bg-green-100 text-green-700',
  'Overdue': 'bg-red-100 text-red-700',
  'Cancelled': 'bg-[#EFECE5] text-gray-700',
}

export default function DCTrackingPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredDCs = dcs.filter(
    (dc) =>
      dc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dc.customer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          DC Tracking
        </h1>
        <p className="text-gray-600">
          Track all delivery challan movements in real-time.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by DC ID or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EFECE5] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
        />
      </div>

      {/* DCs Table */}
      <div className="bg-white rounded-lg border border-[#EFECE5] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#EFECE5] bg-[#F2EFE8]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                DC ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredDCs.map((dc) => (
              <tr key={dc.id} className="border-b border-[#F2EFE8] hover:bg-[#F2EFE8] cursor-pointer transition-colors">
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{dc.id}</td>
                <td className="px-6 py-4">
                  <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-semibold ${dc.type === 'OUT' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    <Truck className="w-3 h-3" />
                    {dc.type}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{dc.customer}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{dc.product}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{dc.date}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[dc.status as keyof typeof statusColors]}`}>
                    {dc.status}
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
