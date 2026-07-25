'use client'

import { useState } from 'react'
import { CustomerCard } from '@/components/customer-card'
import { Modal } from '@/components/modal'
import { Toast } from '@/components/toast'
import {
  Search,
  Mail,
  Phone,
  MapPin,
  Plus,
  Pencil,
  Building2,
  FileText,
  Hash,
  Calendar,
  Activity,
} from 'lucide-react'

interface Customer {
  id: string
  name: string
  contact: string
  email: string
  phone: string
  location: string
  address: string
  gst: string
  status: 'Active' | 'Inactive'
  activeCount: number
  notes: string
  createdAt: string
}

const initialCustomers: Customer[] = [
  {
    id: '1',
    name: 'Nimbus Analytics',
    contact: 'Ritka Sharma',
    email: 'ritka@nimbus.io',
    phone: '+91 98765 43210',
    location: 'Bengaluru',
    address: '4th Floor, Koramangala Tech Park, Bengaluru 560034',
    gst: '29ABCDE1234F1Z5',
    status: 'Active',
    activeCount: 24,
    notes: 'Prefers quarterly billing. Onboarded via referral.',
    createdAt: '2024-02-14',
  },
  {
    id: '2',
    name: 'Coral Media Labs',
    contact: 'Arjun Menon',
    email: 'arjun@corallabs.com',
    phone: '+91 90000 12211',
    location: 'Mumbai',
    address: '221, Andheri East, Mumbai 400069',
    gst: '27XYZAB6789G1Z1',
    status: 'Active',
    activeCount: 8,
    notes: '',
    createdAt: '2024-05-02',
  },
  {
    id: '3',
    name: 'Fernwood Studios',
    contact: 'Priya Iyer',
    email: 'priya@fernwood.co',
    phone: '+91 99887 66554',
    location: 'Pune',
    address: 'Baner Tech Hub, Pune 411045',
    gst: '27MNPQR1122K1Z9',
    status: 'Active',
    activeCount: 12,
    notes: 'Needs on-site support once a month.',
    createdAt: '2024-06-18',
  },
  {
    id: '4',
    name: 'Orbit Consulting',
    contact: 'Kabir Ahuja',
    email: 'kabir@orbit.in',
    phone: '+91 91234 55667',
    location: 'Gurugram',
    address: 'Cyber City, Gurugram 122002',
    gst: '06ORBIT3456L1Z3',
    status: 'Inactive',
    activeCount: 0,
    notes: 'Paused rentals since March.',
    createdAt: '2023-11-09',
  },
  {
    id: '5',
    name: 'Saffron Retail Group',
    contact: 'Deepa Rao',
    email: 'deepa@saffron.co',
    phone: '+91 90909 11223',
    location: 'Hyderabad',
    address: 'HITEC City, Hyderabad 500081',
    gst: '36SAFFR7788M1Z7',
    status: 'Active',
    activeCount: 36,
    notes: '',
    createdAt: '2024-01-22',
  },
  {
    id: '6',
    name: 'Meridian Fintech',
    contact: 'Rohan Kapoor',
    email: 'rohan@meridianfin.com',
    phone: '+91 98444 77889',
    location: 'Chennai',
    address: 'OMR, Chennai 600119',
    gst: '33MERID9900N1Z2',
    status: 'Active',
    activeCount: 6,
    notes: 'Strict SLA — raise tickets within 2h.',
    createdAt: '2024-08-05',
  },
]

type FormState = Omit<Customer, 'id' | 'activeCount' | 'createdAt'>

const emptyForm: FormState = {
  name: '',
  contact: '',
  email: '',
  phone: '',
  location: '',
  address: '',
  gst: '',
  status: 'Active',
  notes: '',
}

function statusToColor(status: 'Active' | 'Inactive'): 'green' | 'gray' {
  return status === 'Active' ? 'green' : 'gray'
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)

  // form modal
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)

  // toast
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
  }

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.location.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCustomerClick = (customer: Customer) => {
    setSelectedCustomer(customer)
  }

  const handleCloseModal = () => {
    setSelectedCustomer(null)
  }

  const openAddForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEditForm = (customer: Customer) => {
    setEditingId(customer.id)
    setForm({
      name: customer.name,
      contact: customer.contact,
      email: customer.email,
      phone: customer.phone,
      location: customer.location,
      address: customer.address,
      gst: customer.gst,
      status: customer.status,
      notes: customer.notes,
    })
    setFormOpen(true)
    setSelectedCustomer(null)
  }

  const handleCloseForm = () => {
    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleFieldChange = (
    field: keyof FormState,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      notify('Customer name is required', 'error')
      return
    }

    if (editingId) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? {
                ...c,
                name: form.name,
                contact: form.contact,
                email: form.email,
                phone: form.phone,
                location: form.location,
                address: form.address,
                gst: form.gst,
                status: form.status,
                notes: form.notes,
              }
            : c
        )
      )
      notify('Customer updated')
    } else {
      const newCustomer: Customer = {
        ...form,
        id: Date.now().toString(),
        activeCount: 0,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      setCustomers((prev) => [newCustomer, ...prev])
      notify('Customer added')
    }
    handleCloseForm()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-2">
            Customers
          </h1>
          <p className="text-gray-600">
            Every account you serve, in one calm view.
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Find a customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-[#EFECE5] rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
        />
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
          Showing {filteredCustomers.length} of {customers.length}
        </div>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => (
          <div key={customer.id} onClick={() => handleCustomerClick(customer)}>
            <CustomerCard
              {...customer}
              onStatusColor={statusToColor(customer.status)}
            />
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">No customers found. Try a different search or add a new customer.</p>
        </div>
      )}

      {/* Customer Detail Modal */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={handleCloseModal}
        title={selectedCustomer?.name || ''}
      >
        {selectedCustomer && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span
                className={`px-2 py-1 rounded text-xs font-semibold ${
                  selectedCustomer.status === 'Active'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-[#EFECE5] text-gray-700'
                }`}
              >
                {selectedCustomer.status.toUpperCase()}
              </span>
              <span className="text-xs text-gray-500">
                {selectedCustomer.activeCount} active rentals
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <DetailRow icon={<Building2 className="w-4 h-4 text-gray-400" />} label="Contact Person" value={selectedCustomer.contact} />
              <DetailRow icon={<Mail className="w-4 h-4 text-gray-400" />} label="Email" value={selectedCustomer.email} />
              <DetailRow icon={<Phone className="w-4 h-4 text-gray-400" />} label="Phone" value={selectedCustomer.phone} />
              <DetailRow icon={<MapPin className="w-4 h-4 text-gray-400" />} label="Location" value={selectedCustomer.location} />
              <DetailRow icon={<MapPin className="w-4 h-4 text-gray-400" />} label="Address" value={selectedCustomer.address} />
              <DetailRow icon={<Hash className="w-4 h-4 text-gray-400" />} label="GST" value={selectedCustomer.gst} />
              <DetailRow icon={<Activity className="w-4 h-4 text-gray-400" />} label="Status" value={selectedCustomer.status} />
              <DetailRow icon={<Calendar className="w-4 h-4 text-gray-400" />} label="Customer since" value={selectedCustomer.createdAt} />
              <DetailRow icon={<FileText className="w-4 h-4 text-gray-400" />} label="Notes" value={selectedCustomer.notes || '—'} />
            </div>

            <div className="pt-4 border-t border-[#EFECE5] grid grid-cols-2 gap-2">
              <button
                onClick={() => openEditForm(selectedCustomer)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => {
                  notify(`Rental initiated for ${selectedCustomer.name}`)
                }}
                className="px-4 py-2 bg-[#F2EFE8] text-gray-900 rounded-lg font-medium hover:bg-[#E7E3DA] transition-colors"
              >
                Create Rental
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Form Modal */}
      <Modal
        isOpen={formOpen}
        onClose={handleCloseForm}
        title={editingId ? 'Edit Customer' : 'Add Customer'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField label="Company Name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="Acme Corp"
              className="form-input"
              autoFocus
            />
          </FormField>

          <FormField label="Contact Person">
            <input
              type="text"
              value={form.contact}
              onChange={(e) => handleFieldChange('contact', e.target.value)}
              placeholder="Jane Doe"
              className="form-input"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
                placeholder="jane@acme.com"
                className="form-input"
              />
            </FormField>
            <FormField label="Phone">
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
                placeholder="+91 ..."
                className="form-input"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="City / Location">
              <input
                type="text"
                value={form.location}
                onChange={(e) => handleFieldChange('location', e.target.value)}
                placeholder="Bengaluru"
                className="form-input"
              />
            </FormField>
            <FormField label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  handleFieldChange('status', e.target.value)
                }
                className="form-input"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </FormField>
          </div>

          <FormField label="Address">
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleFieldChange('address', e.target.value)}
              placeholder="Full street address"
              className="form-input"
            />
          </FormField>

          <FormField label="GST Number">
            <input
              type="text"
              value={form.gst}
              onChange={(e) => handleFieldChange('gst', e.target.value)}
              placeholder="29ABCDE1234F1Z5"
              className="form-input"
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Any notes about this customer..."
              rows={3}
              className="form-input resize-none"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleCloseForm}
              className="px-4 py-2 text-gray-700 rounded-lg font-medium hover:bg-[#F2EFE8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              {editingId ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  )
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2 text-gray-600">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 uppercase font-semibold tracking-wider">
          {label}
        </p>
        <p className="text-sm text-gray-900 break-words mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function FormField({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  )
}