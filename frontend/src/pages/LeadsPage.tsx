'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

const stages = ['New', 'In Progress', 'Qualified', 'Won', 'Lost']

const leads = [
  { id: '1', company: 'TechStart India', contact: 'Rajesh Kumar', stage: 'New', value: '₹5,00,000' },
  { id: '2', company: 'Digital Innovations', contact: 'Priya Singh', stage: 'In Progress', value: '₹8,50,000' },
  { id: '3', company: 'Cloud Solutions Ltd', contact: 'Amit Patel', stage: 'Qualified', value: '₹12,00,000' },
  { id: '4', company: 'Startup Hub', contact: 'Neha Sharma', stage: 'New', value: '₹2,50,000' },
  { id: '5', company: 'Enterprise Corp', contact: 'Vikram Singh', stage: 'In Progress', value: '₹15,00,000' },
]

const stageColors = {
  'New': 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-yellow-100 text-yellow-700',
  'Qualified': 'bg-green-100 text-green-700',
  'Won': 'bg-green-100 text-green-700',
  'Lost': 'bg-[#EFECE5] text-gray-700',
}

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredLeads = leads.filter(
    (lead) =>
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contact.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          Leads & Funnel
        </h1>
        <p className="text-gray-600">
          Track every opportunity from first call to close.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Find a lead..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EFECE5] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
        />
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4">
        {stages.map((stage) => (
          <div key={stage} className="bg-[#F2EFE8] rounded-lg p-4 min-h-96">
            <h3 className="font-semibold text-gray-900 mb-4 text-sm">{stage}</h3>
            <div className="space-y-3">
              {filteredLeads
                .filter((lead) => lead.stage === stage)
                .map((lead) => (
                  <div
                    key={lead.id}
                    className="bg-white rounded-lg p-3 border border-[#EFECE5] shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                  >
                    <p className="font-semibold text-sm text-gray-900">
                      {lead.company}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">{lead.contact}</p>
                    <p className="text-sm font-bold text-gray-900 mt-2">
                      {lead.value}
                    </p>
                    <div className={`text-xs font-semibold mt-2 px-2 py-1 rounded inline-block ${stageColors[stage as keyof typeof stageColors]}`}>
                      {stage}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
