import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import {
  assignCustomers,
  fetchMappingCustomers,
  fetchMappingEmployees,
  type MappingCustomer,
  type MappingEmployee,
} from '@/sales/lib/customerMappingApi'

const tableCellClass = 'px-4 py-3 border-r border-[#D1D5DB]'
const PAGE_SIZES = [10, 25, 50, 100]

export default function CustomerMappingPage() {
  const [customers, setCustomers] = useState<MappingCustomer[]>([])
  const [employees, setEmployees] = useState<MappingEmployee[]>([])
  const [search, setSearch] = useState('')
  const [assignment, setAssignment] = useState('all')
  const [employeeId, setEmployeeId] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [modalCustomerIds, setModalCustomerIds] = useState<string[]>([])
  const [modalEmployeeIds, setModalEmployeeIds] = useState<string[]>([])
  const [modalSearch, setModalSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    void fetchMappingEmployees()
      .then((response) => setEmployees(response.data || []))
      .catch((error: unknown) => setMessage({ text: error instanceof Error ? error.message : 'Failed to load employees.', type: 'error' }))
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true)
      void fetchMappingCustomers({ search, assignment, employeeId, page, limit })
        .then((response) => {
          setCustomers(response.data || [])
          setTotal(response.pagination?.total || 0)
          setTotalPages(response.pagination?.totalPages || 1)
        })
        .catch((error: unknown) => setMessage({ text: error instanceof Error ? error.message : 'Failed to load customers.', type: 'error' }))
        .finally(() => setLoading(false))
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [search, assignment, employeeId, page, limit])

  const visibleEmployees = useMemo(() => {
    const value = modalSearch.trim().toLowerCase()
    return value
      ? employees.filter((employee) => `${employee.name} ${employee.email || ''} ${employee.employeeType || ''}`.toLowerCase().includes(value))
      : employees
  }, [employees, modalSearch])

  const allCurrentSelected = customers.length > 0 && customers.every((customer) => selectedIds.includes(customer._id))
  const summaryText = total === 0 ? 'Showing 0 to 0 of 0 entries' : `Showing ${(page - 1) * limit + 1} to ${Math.min(page * limit, total)} of ${total} entries`

  useEffect(() => {
    setPage(1)
  }, [search, assignment, employeeId, limit])

  const toggleCustomer = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }

  const openAssignModal = (ids: string[]) => {
    const first = customers.find((customer) => customer._id === ids[0])
    setModalCustomerIds(ids)
    setModalEmployeeIds(first?.assignedEmployees?.map((employee) => employee.employeeId) || [])
    setModalSearch('')
    setModalOpen(true)
  }

  const closeModal = () => {
    if (!saving) setModalOpen(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await assignCustomers(modalCustomerIds, modalEmployeeIds)
      setMessage({ text: 'Assignment saved.', type: 'success' })
      setModalOpen(false)
      setSelectedIds([])
      const response = await fetchMappingCustomers({ search, assignment, employeeId, page, limit })
      setCustomers(response.data || [])
      setTotal(response.pagination?.total || 0)
      setTotalPages(response.pagination?.totalPages || 1)
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Failed to save customer assignment.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-heading">Customer Mapping</h1>
        {/* <p className="mt-1 text-sm text-[#6B6657]">Assign customers to employees. Assigned employees can work on these customers.</p> */}
      </div>
      {message && (
        <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="rounded-xl border border-[#EFECE5] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm font-medium text-gray-700">
            Search customer
            <div className="relative mt-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer" className="w-full rounded-lg border border-[#EFECE5] py-2 pl-9 pr-3 text-sm outline-none focus:border-[#111827]" />
            </div>
          </label>
          <label className="text-sm font-medium text-gray-700">Assignment
            <select value={assignment} onChange={(event) => setAssignment(event.target.value)} className="mt-1 block rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm">
              <option value="all">All</option><option value="assigned">Assigned</option><option value="unassigned">Unassigned</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Employee
            <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} className="mt-1 block min-w-[180px] rounded-lg border border-[#EFECE5] bg-white px-3 py-2 text-sm">
              <option value="">All</option>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
            </select>
          </label>
        </div>
        {selectedIds.length > 0 && <button type="button" onClick={() => openAssignModal(selectedIds)} className="mt-5 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E293B]">Assign selected ({selectedIds.length})</button>}
        <div className="mt-5 overflow-x-auto rounded-lg border border-[#EFECE5]">
          <table className="w-full min-w-[850px]">
            <thead><tr className="border-b border-[#EFECE5] bg-[#F2EFE8]">
              <th className={tableCellClass}><input type="checkbox" checked={allCurrentSelected} onChange={() => setSelectedIds(allCurrentSelected ? selectedIds.filter((id) => !customers.some((customer) => customer._id === id)) : Array.from(new Set([...selectedIds, ...customers.map((customer) => customer._id)])))} aria-label="Select all customers on page" /></th>
              {['SL No.', 'Customer ID', 'Customer Name', 'Account Type', 'Assigned To', 'Action'].map((heading) => <th key={heading} className={`${tableCellClass} text-left text-xs font-semibold uppercase tracking-wider text-gray-600`}>{heading}</th>)}
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-500">Loading...</td></tr> : customers.length === 0 ? <tr><td colSpan={7} className="px-6 py-16 text-center text-gray-500">No customers found</td></tr> : customers.map((customer, index) => {
                const assigned = customer.assignedEmployees || []
                return <tr key={customer._id} className="border-b border-[#EFECE5] text-sm text-gray-700">
                  <td className={tableCellClass}><input type="checkbox" checked={selectedIds.includes(customer._id)} onChange={() => toggleCustomer(customer._id)} aria-label={`Select ${customer.companyName || customer.customerName || 'customer'}`} /></td>
                  <td className={tableCellClass}>{(page - 1) * limit + index + 1}</td>
                  <td className={tableCellClass}>{customer.customerId || '—'}</td>
                  <td className={tableCellClass}>{customer.companyName || customer.customerName || '—'}</td>
                  <td className={tableCellClass}>{customer.accountType || '—'}</td>
                  <td className={tableCellClass}>{assigned.length ? assigned.map((employee) => employee.employeeName).join(', ') : <span className="text-gray-400">Unassigned</span>}</td>
                  <td className={tableCellClass}><button type="button" onClick={() => openAssignModal([customer._id])} className="rounded-lg bg-[#111827] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1E293B]">Assign</button></td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500"><span>Show</span><select value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="rounded border border-[#EFECE5] bg-white px-2 py-1.5 text-sm text-gray-700">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select><span>entries</span></div>
          <div className="text-sm text-gray-500">{summaryText}</div>
          <div className="flex items-center gap-2"><button type="button" className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}><ChevronLeft className="h-4 w-4" /></button><span className="text-sm text-gray-600">Page {page} of {totalPages}</span><button type="button" className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(value + 1, totalPages))}><ChevronRight className="h-4 w-4" /></button></div>
        </div>
      </div>
      {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal() }}>
        <div className="w-full max-w-md rounded-xl border border-[#EFECE5] bg-white p-6 shadow-xl">
          <h2 className="text-xl font-semibold text-[#1F1D1A]">Assign Customers</h2>
          <p className="mt-2 text-sm text-[#6B6657]">{modalCustomerIds.length} customer(s) selected. The employees you choose replace the current assignment. Leave all unticked to remove the assignment.</p>
          <input value={modalSearch} onChange={(event) => setModalSearch(event.target.value)} placeholder="Search employees" className="mt-4 w-full rounded-lg border border-[#EFECE5] px-3 py-2 text-sm outline-none focus:border-[#111827]" />
          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[#EFECE5] p-3">
            {visibleEmployees.map((employee) => <label key={employee.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-[#F8F7F3]"><input type="checkbox" checked={modalEmployeeIds.includes(employee.id)} onChange={() => setModalEmployeeIds((current) => current.includes(employee.id) ? current.filter((id) => id !== employee.id) : [...current, employee.id])} /><span className="text-sm text-gray-700">{employee.name}<span className="ml-2 text-xs text-gray-400">{employee.employeeType || '—'}</span></span></label>)}
          </div>
          <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={saving} onClick={closeModal} className="rounded-lg border border-[#EFECE5] px-4 py-2 text-sm text-gray-700 disabled:opacity-50">Cancel</button><button type="button" disabled={saving} onClick={() => void handleSave()} className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E293B] disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button></div>
        </div>
      </div>}
    </div>
  )
}
