'use client'

import { StatCard } from '@/components/stat-card'
import { Activity, Zap, FileText, Package } from 'lucide-react'

const recentActivity = [
  {
    id: 1,
    type: 'deal',
    company: 'Nimbus Analytics',
    action: 'moved',
    target: 'In Progress',
    time: '2h ago',
  },
  {
    id: 2,
    type: 'dispatch',
    company: 'Coral Media Labs',
    action: 'dispatched',
    target: 'DC-OUT-3313',
    time: '4h ago',
  },
  {
    id: 3,
    type: 'purchase',
    company: 'Coral Media Labs',
    action: 'pending approval',
    target: 'PO-2025-042',
    time: 'yesterday',
  },
  {
    id: 4,
    type: 'payment',
    company: 'Fernwood Studios',
    action: 'paid',
    target: 'INV-2026-0117',
    time: 'yesterday',
  },
  {
    id: 5,
    type: 'overdue',
    company: 'Saffron Retail',
    action: 'marked overdue',
    target: 'DC-IN-2202',
    time: '2 days ago',
  },
]

const leadsToFollowUp = [
  {
    id: 1,
    company: 'Nimbus Analytics',
    product: '20x Dell OptiPlex 7010 (i5 / 16GB)',
    contact: 'Anaya Patel',
  },
  {
    id: 2,
    company: 'Coral Media Labs',
    product: '8x HP Z2 Workstation (Xeon / 32GB)',
    contact: 'Vikram Shah',
  },
  {
    id: 3,
    company: 'Orbit Consulting',
    product: '40x Lenovo ThinkCentre M70',
    contact: 'Anaya Patel',
  },
  {
    id: 4,
    company: 'Saffron Retail Group',
    product: '60x Refurb Dell 3080 Micro',
    contact: 'Vikram Shah',
  },
]

const dcsNeedingAttention = [
  {
    id: 1,
    company: 'Coral Media Labs',
    product: 'HP Z2 Workstation × 4',
    status: 'DISPATCHED',
  },
  {
    id: 2,
    company: 'Saffron Retail Group',
    product: 'Refurb Dell 3080 Micro',
    status: 'OVERDUE',
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
          Good morning, Anaya
        </h1>
        <p className="text-gray-600">Here&apos;s what&apos;s moving today.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-6">
        <StatCard
          icon={Package}
          label="Active Rentals"
          value="86"
          description="PCs currently deployed at client sites"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-700"
        />
        <StatCard
          icon={Zap}
          label="Open Leads"
          value="5"
          description="Deals still in New or In Progress"
          iconBg="bg-amber-100"
          iconColor="text-amber-700"
        />
        <StatCard
          icon={FileText}
          label="Pending DCs"
          value="4"
          description="1 overdue · needs a nudge"
          iconBg="bg-rose-100"
          iconColor="text-rose-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="col-span-2 bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif font-bold text-gray-900">
              Recent activity
            </h2>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              LAST 48 HOURS
            </span>
          </div>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">
                    <span className="font-medium">{activity.company}</span>{' '}
                    {activity.action} {activity.target} to{' '}
                    <span className="font-medium">{activity.target}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Leads to Follow Up */}
          <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-serif font-bold text-gray-900">
                Leads to follow up
              </h3>
            </div>
            <div className="space-y-4">
              {leadsToFollowUp.map((lead) => (
                <div key={lead.id} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-gray-900">{lead.company}</p>
                  <p className="text-xs text-gray-600 mt-1">{lead.product}</p>
                  <p className="text-xs text-gray-500 mt-1">{lead.contact}</p>
                </div>
              ))}
            </div>
          </div>

          {/* DCs Needing Attention */}
          <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-rose-600" />
              <h3 className="text-lg font-serif font-bold text-gray-900">
                DCs needing attention
              </h3>
            </div>
            <div className="space-y-4">
              {dcsNeedingAttention.map((dc, index) => (
                <div key={dc.id} className={`pb-4 ${index < dcsNeedingAttention.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <p className="text-sm font-medium text-gray-900">{dc.company}</p>
                  <p className="text-xs text-gray-600 mt-1">{dc.product}</p>
                  <p className={`text-xs mt-2 font-semibold ${
                    dc.status === 'DISPATCHED'
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}>
                    {dc.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
