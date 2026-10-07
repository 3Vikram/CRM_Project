'use client'

import { useState } from 'react'
import { Search, FileText } from 'lucide-react'

const bills = [
  { id: 'INV-2026-0117', customer: 'Fernwood Studios', amount: '₹4,50,000', dueDate: '2025-02-15', status: 'Paid' },
  { id: 'INV-2026-0116', customer: 'Coral Media Labs', amount: '₹8,25,000', dueDate: '2025-02-10', status: 'Pending' },
  { id: 'INV-2026-0115', customer: 'Nimbus Analytics', amount: '₹15,00,000', dueDate: '2025-01-30', status: 'Overdue' },
  { id: 'INV-2026-0114', customer: 'Saffron Retail', amount: '₹12,50,000', dueDate: '2025-01-28', status: 'Overdue' },
  { id: 'INV-2026-0113', customer: 'Orbit Consulting', amount: '₹6,75,000', dueDate: '2025-02-05', status: 'Pending' },
]

const statusColors = {
  'Paid': 'bg-green-100 text-green-700',
  'Pending': 'bg-yellow-100 text-yellow-700',
  'Overdue': 'bg-red-100 text-red-700',
  'Cancelled': 'bg-[#EFECE5] text-gray-700',
}

export default function BillSalePage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredBills = bills.filter(
    (bill) =>
      bill.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      bill.customer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalAmount = bills.reduce((sum, bill) => sum + parseInt(bill.amount.replace(/[^\d]/g, '')), 0)
  const paidAmount = bills
    .filter(bill => bill.status === 'Paid')
    .reduce((sum, bill) => sum + parseInt(bill.amount.replace(/[^\d]/g, '')), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          Bills & Sales
        </h1>
        <p className="text-gray-600">
          Track all invoices and payment status.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Total Invoiced
          </div>
          <div className="text-3xl font-bold text-gray-900">
            ₹{(totalAmount / 100000).toFixed(1)}L
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Amount Collected
          </div>
          <div className="text-3xl font-bold text-green-600">
            ₹{(paidAmount / 100000).toFixed(1)}L
          </div>
        </div>
        <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Outstanding
          </div>
          <div className="text-3xl font-bold text-red-600">
            ₹{((totalAmount - paidAmount) / 100000).toFixed(1)}L
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by invoice or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EFECE5] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
        />
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-lg border border-[#EFECE5] overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#EFECE5] bg-[#F2EFE8]">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Invoice ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Customer
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredBills.map((bill) => (
              <tr key={bill.id} className="border-b border-[#F2EFE8] hover:bg-[#F2EFE8] cursor-pointer transition-colors">
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{bill.id}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{bill.customer}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{bill.amount}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{bill.dueDate}</td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[bill.status as keyof typeof statusColors]}`}>
                    {bill.status}
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
