import { Building2, Mail, Phone, MapPin } from 'lucide-react'

interface CustomerCardProps {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  location: string
  address?: string
  gst?: string
  status?: 'Active' | 'Inactive'
  activeCount: number
  notes?: string
  createdAt?: string
  onStatusColor?: 'green' | 'amber' | 'gray'
}

export function CustomerCard({
  id,
  name,
  contact,
  email,
  phone,
  location,
  activeCount,
  onStatusColor = 'green',
}: CustomerCardProps) {
  const statusColors = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    gray: 'bg-[#EFECE5] text-gray-700',
  }

  return (
    <div className="bg-white rounded-lg border border-[#EFECE5] p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <Building2 className="w-6 h-6 text-gray-400 mt-1 flex-shrink-0" />
          <div>
            <h3 className="text-lg font-serif font-bold text-gray-900">{name}</h3>
            <p className="text-sm text-gray-600">{contact}</p>
          </div>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-semibold ${statusColors[onStatusColor]}`}>
          {activeCount} ACTIVE
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>{email}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>{phone}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span>{location}</span>
        </div>
      </div>
    </div>
  )
}
