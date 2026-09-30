'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Eye, Pencil, Trash2, UserCog } from 'lucide-react'
import { Modal } from '@/components/modal'
import { Toast } from '@/components/toast'
import { deleteEmployee, fetchEmployees, type EmployeeRecord } from '@/lib/employeeApi'

const tableCellClass = 'px-3 py-3 border-r border-[#E5E7EB] align-top whitespace-nowrap'

const formatDate = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const formatList = (values?: string[] | null) => {
  if (!values || values.length === 0) return '—'
  return values.join(', ')
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const searchTimeoutRef = useRef<number | null>(null)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
  }

  const loadEmployees = async (nextPage = page, nextLimit = pageSize, nextSearch = searchQuery) => {
    setIsLoading(true)
    try {
      const response = await fetchEmployees({
        search: nextSearch,
        page: nextPage,
        limit: nextLimit,
      })
      setEmployees(response.data || [])
      setTotalPages(response.pagination?.totalPages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to load employees', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      void loadEmployees(page, pageSize, searchQuery)
    }, 400)

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)
    }
  }, [page, pageSize, searchQuery])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, pageSize])

  const roleOptions = useMemo(() => Array.from(new Set(employees.map((employee) => employee.role).filter(Boolean))).sort(), [employees])
  const statusOptions = useMemo(() => Array.from(new Set(employees.map((employee) => employee.status).filter(Boolean))).sort(), [employees])
  const departmentOptions = useMemo(() => Array.from(new Set(employees.map((employee) => employee.department).filter(Boolean))).sort(), [employees])

  const handleAddNew = () => navigate('/sales/employees/new')
  const handleEdit = (employee: EmployeeRecord) => navigate(`/sales/employees/edit/${employee._id}`)
  const handleView = (employee: EmployeeRecord) => setSelectedEmployee(employee)

  const handleDelete = async (employee: EmployeeRecord) => {
    try {
      await deleteEmployee(employee._id)
      setEmployees((prev) => prev.filter((item) => item._id !== employee._id))
      setSelectedEmployee(null)
      notify('Employee deleted successfully')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to delete employee', 'error')
    }
  }

  const handleDownload = () => {
    const rows = employees.map((employee) => [
      employee.officialEmployeeId || employee.employeeCode || '',
      employee.createdBy || '',
      employee.employeeName || '',
      employee.email || '',
      employee.contactNo || employee.phone || '',
      employee.designation || '',
      employee.department || '',
      formatDate(employee.dateOfJoin || employee.joiningDate),
      formatDate(employee.dateOfBirth),
      employee.reportingTo || '',
      employee.branchCode || '',
      formatList(employee.crudOption),
      formatList(employee.modulesOption),
    ])

    const csv = [
      ['Official Employee Id', 'Created By', 'Full Name', 'Email Id', 'Contact No', 'Designation', 'Department', 'Date of Join', 'Date of Birth', 'Reporting To', 'Branch Code', 'CRUD Option', 'Modules Option'],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'employee-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
        <h1 className="crm-page-heading">Employee List</h1>
        <div className="flex items-center gap-3">
          <button type="button" onClick={handleAddNew} className="rounded bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B]">
            ADD NEW +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className="rounded border border-[#D1D5DB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700">Copy</button>
          <button type="button" className="rounded border border-[#D1D5DB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700">CSV</button>
          <button type="button" className="rounded border border-[#D1D5DB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700">Print</button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-full md:w-80">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                className="w-full rounded border border-[#D1D5DB] bg-white py-2 pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded border border-[#E5E7EB] bg-white shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1500px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] text-slate-700">
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Official Employee Id</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Created By</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Full Name</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Email Id</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Contact No</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Designation</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Department</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Date of Join</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Date of Birth</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Reporting To</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Branch Code</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>CRUD Option</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Modules Option</th>
                  <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.length > 0 ? (
                  employees.map((employee) => (
                    <tr key={employee._id} className="border-b border-[#EEF2F7] hover:bg-slate-50">
                      <td className={tableCellClass}>{employee.officialEmployeeId || employee.employeeCode || '—'}</td>
                      <td className={tableCellClass}>{employee.createdBy || 'Admin'}</td>
                      <td className={tableCellClass}>
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-sky-700">
                            {employee.employeeName?.slice(0, 2).toUpperCase() || 'EM'}
                          </div>
                          <span>{employee.employeeName || employee.fullName || '—'}</span>
                        </div>
                      </td>
                      <td className={tableCellClass}>{employee.email || '—'}</td>
                      <td className={tableCellClass}>{employee.contactNo || employee.phone || '—'}</td>
                      <td className={tableCellClass}>{employee.designation || '—'}</td>
                      <td className={tableCellClass}>{employee.department || 'Sales'}</td>
                      <td className={tableCellClass}>{formatDate(employee.dateOfJoin || employee.joiningDate)}</td>
                      <td className={tableCellClass}>{formatDate(employee.dateOfBirth)}</td>
                      <td className={tableCellClass}>{employee.reportingTo || '—'}</td>
                      <td className={tableCellClass}>{employee.branchCode || '—'}</td>
                      <td className={tableCellClass}>{formatList(employee.crudOption)}</td>
                      <td className={tableCellClass}>{formatList(employee.modulesOption)}</td>
                      <td className={`${tableCellClass} pr-2`}>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => handleView(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleEdit(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDelete(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={14} className="px-6 py-16 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <UserCog className="h-8 w-8 text-slate-300" />
                        <p>No employees found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-sm">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Showing {(totalCount === 0 ? 0 : (page - 1) * pageSize + 1)} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries</span>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded border border-[#D1D5DB] bg-white px-2 py-1 disabled:opacity-40" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>←</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" className="rounded border border-[#D1D5DB] bg-white px-2 py-1 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>→</button>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={Boolean(selectedEmployee)} onClose={() => setSelectedEmployee(null)} title={selectedEmployee?.employeeName || 'Employee Details'}>
        {selectedEmployee ? (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm text-slate-700">
              <div><span className="font-semibold text-slate-600">Official Employee Id:</span> {selectedEmployee.officialEmployeeId || selectedEmployee.employeeCode || '—'}</div>
              <div><span className="font-semibold text-slate-600">Created By:</span> {selectedEmployee.createdBy || 'Admin'}</div>
              <div><span className="font-semibold text-slate-600">Full Name:</span> {selectedEmployee.employeeName || selectedEmployee.fullName || '—'}</div>
              <div><span className="font-semibold text-slate-600">Email Id:</span> {selectedEmployee.email || '—'}</div>
              <div><span className="font-semibold text-slate-600">Contact No:</span> {selectedEmployee.contactNo || selectedEmployee.phone || '—'}</div>
              <div><span className="font-semibold text-slate-600">Designation:</span> {selectedEmployee.designation || '—'}</div>
              <div><span className="font-semibold text-slate-600">Department:</span> {selectedEmployee.department || 'Sales'}</div>
              <div><span className="font-semibold text-slate-600">Date of Join:</span> {formatDate(selectedEmployee.dateOfJoin || selectedEmployee.joiningDate)}</div>
              <div><span className="font-semibold text-slate-600">Date of Birth:</span> {formatDate(selectedEmployee.dateOfBirth)}</div>
              <div><span className="font-semibold text-slate-600">Reporting To:</span> {selectedEmployee.reportingTo || '—'}</div>
              <div><span className="font-semibold text-slate-600">Branch Code:</span> {selectedEmployee.branchCode || '—'}</div>
              <div><span className="font-semibold text-slate-600">CRUD Option:</span> {formatList(selectedEmployee.crudOption)}</div>
              <div><span className="font-semibold text-slate-600">Modules Option:</span> {formatList(selectedEmployee.modulesOption)}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#E5E7EB] pt-4">
              <button onClick={() => handleEdit(selectedEmployee)} className="rounded bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B]">Edit Employee</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Toast isOpen={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
    </div>
  )
}
