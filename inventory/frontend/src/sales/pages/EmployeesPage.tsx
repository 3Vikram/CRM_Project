'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Eye, Pencil, Trash2, UserCog } from 'lucide-react'
import { Modal } from '@/sales/components/modal'
import { Toast } from '@/sales/components/toast'
import { deleteEmployee, fetchEmployees, type EmployeeRecord } from '@/sales/lib/employeeApi'
import { PermissionGate } from '@/sales/components/PermissionGate'
import { downloadExcelReport } from '@/lib/downloadExcelReport'
import { toExcelDate } from '@/sales/lib/excelFormat'
import {
  clearInventorySession,
  getInventorySessionToken,
  setInventorySessionToken,
  signInToInventory,
  verifyInventorySession,
} from '@/lib/inventoryAuth'

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

interface InventoryEmployeeRecord {
  _id: string
  employeeName: string
  email: string
  isActive: boolean
  createdAt?: string
}

function InventoryEmployeesPanel() {
  const [token, setToken] = useState('')
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [employees, setEmployees] = useState<InventoryEmployeeRecord[]>([])
  const [employeeName, setEmployeeName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState<InventoryEmployeeRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const loadEmployees = async (sessionToken: string) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch('/api/inventory/employees', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      const result = await response.json()
      if (response.status === 403) {
        setToken('')
        throw new Error('This Inventory account cannot manage employees. Sign in with the Inventory administrator credentials.')
      }
      if (response.status === 401) {
        clearInventorySession()
        setToken('')
      }
      if (!response.ok) throw new Error(result.error || 'Unable to load Inventory employees.')
      setEmployees(result.data || [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load Inventory employees.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const storedToken = getInventorySessionToken()
    if (!storedToken) {
      setIsCheckingSession(false)
      return
    }

    let cancelled = false
    void verifyInventorySession(storedToken)
      .then((isValid) => {
        if (cancelled) return
        if (!isValid) {
          clearInventorySession()
          return
        }
        setToken(storedToken)
        void loadEmployees(storedToken)
      })
      .catch(() => {
        if (!cancelled) clearInventorySession()
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleInventoryLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      const sessionToken = await signInToInventory(loginEmail, loginPassword)
      setInventorySessionToken(sessionToken)
      setToken(sessionToken)
      setLoginPassword('')
      await loadEmployees(sessionToken)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in to Inventory.')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setEmployeeName('')
    setEmail('')
    setPassword('')
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    setIsSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch(
        editingId ? `/api/inventory/employees/${editingId}` : '/api/inventory/employees',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ employeeName, email, ...(password ? { password } : {}) }),
        }
      )
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save Inventory employee.')
      resetForm()
      setMessage(editingId ? 'Inventory employee updated.' : 'Inventory employee created.')
      await loadEmployees(token)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save Inventory employee.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeactivate = async (employee: InventoryEmployeeRecord) => {
    if (!token || !window.confirm(`Deactivate ${employee.employeeName}?`)) return
    setError('')
    setMessage('')
    try {
      const response = await fetch(`/api/inventory/employees/${employee._id}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to deactivate Inventory employee.')
      setEmployees((current) => current.map((item) => item._id === employee._id ? result.data : item))
      setMessage('Inventory employee deactivated.')
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate Inventory employee.')
    }
  }

  const handleSignOut = () => {
    clearInventorySession()
    setToken('')
    setEmployees([])
    resetForm()
  }

  if (isCheckingSession) return <p className="text-sm text-slate-600">Checking Inventory administrator session...</p>

  if (!token) {
    return (
      <section className="max-w-xl rounded border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Inventory employee management</h2>
        <p className="mt-1 text-sm text-slate-600">Sign in with the existing Inventory administrator credentials to manage Inventory employees.</p>
        {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <form onSubmit={handleInventoryLogin} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input aria-label="Inventory administrator email" autoComplete="username" className="rounded border border-[#D1D5DB] px-3 py-2 text-sm" onChange={(event) => setLoginEmail(event.target.value)} placeholder="Administrator email" required type="email" value={loginEmail} />
          <input aria-label="Inventory administrator password" autoComplete="current-password" className="rounded border border-[#D1D5DB] px-3 py-2 text-sm" onChange={(event) => setLoginPassword(event.target.value)} placeholder="Password" required type="password" value={loginPassword} />
          <button className="rounded bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B] sm:col-span-2" type="submit">Sign in to Inventory</button>
        </form>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Inventory employees</h2>
          {/* <p className="text-sm text-slate-600">Inventory credentials are separate from Sales employee accounts.</p> */}
        </div>
        <button className="rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={handleSignOut} type="button">Sign out of Inventory admin</button>
      </div>

      {error ? <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p> : null}

      <form onSubmit={handleSave} className="grid gap-3 rounded border border-[#E5E7EB] bg-white p-4 shadow-sm md:grid-cols-4">
        <h3 className="font-semibold text-slate-800 md:col-span-4">{editingId ? 'Edit Inventory employee' : 'Add Inventory employee'}</h3>
        <input aria-label="Employee name" className="rounded border border-[#D1D5DB] px-3 py-2 text-sm" onChange={(event) => setEmployeeName(event.target.value)} placeholder="Employee name" required value={employeeName} />
        <input aria-label="Employee email" className="rounded border border-[#D1D5DB] px-3 py-2 text-sm" onChange={(event) => setEmail(event.target.value)} placeholder="Email" required type="email" value={email} />
        <input aria-label={editingId ? 'New password (optional)' : 'Password'} autoComplete="new-password" className="rounded border border-[#D1D5DB] px-3 py-2 text-sm" minLength={8} onChange={(event) => setPassword(event.target.value)} placeholder={editingId ? 'New password (optional)' : 'Password (8+ characters)'} required={!editingId} type="password" value={password} />
        <div className="flex gap-2">
          <button className="rounded bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B] disabled:opacity-50" disabled={isSaving} type="submit">{isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Add employee'}</button>
          {editingId ? <button className="rounded border border-[#D1D5DB] px-3 py-2 text-sm text-slate-700" onClick={resetForm} type="button">Cancel</button> : null}
        </div>
      </form>

      <div className="overflow-x-auto rounded border border-[#E5E7EB] bg-white shadow-sm">
        <table className="w-full min-w-[850px] border-collapse text-left text-sm">
          <thead className="text-slate-700">
            <tr className="border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Employee</th>
              <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Email</th>
              <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Status</th>
              <th className={`${tableCellClass} font-semibold uppercase text-[11px] tracking-wide`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr className="border-b border-[#EEF2F7] hover:bg-slate-50" key={employee._id}>
                <td className={tableCellClass}>{employee.employeeName}</td>
                <td className={tableCellClass}>{employee.email}</td>
                <td className={tableCellClass}>{employee.isActive ? 'Active' : 'Inactive'}</td>
                <td className={`${tableCellClass} pr-2`}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setSelectedEmployee(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="View" aria-label={`View ${employee.employeeName}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => { setEditingId(employee._id); setEmployeeName(employee.employeeName); setEmail(employee.email); setPassword(''); setMessage('') }} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="Edit" aria-label={`Edit ${employee.employeeName}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {employee.isActive ? (
                      <button type="button" onClick={() => void handleDeactivate(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="Deactivate" aria-label={`Deactivate ${employee.employeeName}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && employees.length === 0 ? <tr className="border-b border-[#EEF2F7]"><td className="px-6 py-16 text-center text-slate-500" colSpan={4}>No Inventory employees found.</td></tr> : null}
            {isLoading ? <tr className="border-b border-[#EEF2F7]"><td className="px-6 py-16 text-center text-slate-500" colSpan={4}>Loading Inventory employees...</td></tr> : null}
          </tbody>
        </table>
      </div>

      <Modal isOpen={Boolean(selectedEmployee)} onClose={() => setSelectedEmployee(null)} title={selectedEmployee?.employeeName || 'Inventory employee'}>
        {selectedEmployee ? <div className="space-y-2 text-sm text-slate-700"><p><strong>Email:</strong> {selectedEmployee.email}</p><p><strong>Status:</strong> {selectedEmployee.isActive ? 'Active' : 'Inactive'}</p><p><strong>Created:</strong> {selectedEmployee.createdAt ? formatDate(selectedEmployee.createdAt) : '—'}</p></div> : null}
      </Modal>
    </section>
  )
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
  const [activeModule, setActiveModule] = useState<'sales' | 'inventory' | 'accounts'>('sales')

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
    if (activeModule !== 'sales') return
    if (searchTimeoutRef.current) {
      window.clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = window.setTimeout(() => {
      void loadEmployees(page, pageSize, searchQuery)
    }, 400)

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)
    }
  }, [activeModule, page, pageSize, searchQuery])

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

  const handleDownload = async () => {
    const headers = ['SL No.', 'Official Employee Id', 'Employee Type', 'Full Name', 'Email Id', 'Contact No', 'Designation', 'Department', 'Date of Join', 'Date of Birth', 'Reporting To', 'Branch Code', 'CRUD Option', 'Modules Option']
    const rows = employees.map((employee, index) => [
      index + 1,
      String(employee.officialEmployeeId || employee.employeeCode || ''),
      employee.employeeType || '',
      employee.employeeName || '',
      employee.email || '',
      (employee.contactNo || employee.phone) ? String(employee.contactNo || employee.phone) : '',
      employee.designation || '',
      employee.department || '',
      toExcelDate(employee.dateOfJoin || employee.joiningDate),
      toExcelDate(employee.dateOfBirth),
      employee.reportingTo || '',
      employee.branchCode || '',
      employee.crudOption?.join(', ') || '',
      employee.modulesOption?.join(', ') || '',
    ])

    try {
      await downloadExcelReport({
        fileName: 'employee-report.xlsx',
        sheetName: 'Employees',
        headers,
        rows,
        textColumns: [1, 4, 5, 8, 9, 11],
        centerColumns: [0, 1, 5, 8, 9, 11],
        leftColumns: [2, 3, 4, 6, 7, 10, 12, 13],
        wrapColumns: [3, 4, 6, 7, 10, 12, 13],
        wideColumns: [3, 4, 10, 12, 13],
        columnWidths: [8, 18, 22, 32, 34, 18, 24, 24, 14, 14, 28, 16, 36, 36],
      })
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to download employee report', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
        <h1 className="crm-page-heading">Employee List</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div aria-label="Employee module" className="inline-flex rounded border border-[#D1D5DB] bg-white p-1" role="group">
            {(['sales', 'inventory', 'accounts'] as const).map((module) => (
              <button
                aria-pressed={activeModule === module}
                className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${activeModule === module ? 'bg-[#0F172A] text-white' : 'text-slate-700 hover:bg-slate-100'}`}
                key={module}
                onClick={() => setActiveModule(module)}
                type="button"
              >
                {module === 'sales' ? 'Sales' : module === 'inventory' ? 'Inventory' : 'Accounts'}
              </button>
            ))}
          </div>
          {activeModule === 'sales' ? (
            <PermissionGate moduleName="employees" action="create">
              <button type="button" onClick={handleAddNew} className="rounded bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B]">
                ADD NEW +
              </button>
            </PermissionGate>
          ) : null}
        </div>
      </div>

      {activeModule === 'sales' ? (
        <>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className="rounded border border-[#D1D5DB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700">Copy</button>
          <button type="button" onClick={() => void handleDownload()} className="rounded border border-[#D1D5DB] bg-white px-2 py-1.5 text-xs font-medium text-slate-700">CSV</button>
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
            <table className="employee-list-table min-w-[1500px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] text-slate-700">
                  <th className={tableCellClass}>Official Employee Id</th>
                  <th className={tableCellClass}>Employee Type</th>
                  <th className={tableCellClass}>Full Name</th>
                  <th className={tableCellClass}>Email Id</th>
                  <th className={tableCellClass}>Contact No</th>
                  <th className={tableCellClass}>Designation</th>
                  <th className={tableCellClass}>Department</th>
                  <th className={tableCellClass}>Date of Join</th>
                  <th className={tableCellClass}>Date of Birth</th>
                  <th className={tableCellClass}>Reporting To</th>
                  <th className={tableCellClass}>Branch Code</th>
                  <th className={tableCellClass}>CRUD Option</th>
                  <th className={tableCellClass}>Modules Option</th>
                  <th className={tableCellClass}>Action</th>
                </tr>
              </thead>
              <tbody>
                {employees.length > 0 ? (
                  employees.map((employee) => (
                    <tr key={employee._id} className="border-b border-[#EEF2F7] hover:bg-slate-50">
                      <td className={tableCellClass}>{employee.officialEmployeeId || employee.employeeCode || '—'}</td>
                      <td className={tableCellClass}>{employee.employeeType || '—'}</td>
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
                          <PermissionGate moduleName="employees" action="edit">
                            <button type="button" onClick={() => handleEdit(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>
                          <PermissionGate moduleName="employees" action="delete">
                            <button type="button" onClick={() => handleDelete(employee)} className="rounded border border-[#E5E7EB] bg-white p-1.5 text-slate-600 hover:bg-slate-100" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </PermissionGate>
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
              <div><span className="font-semibold text-slate-600">Employee Type:</span> {selectedEmployee.employeeType || '—'}</div>
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
        </>
      ) : activeModule === 'inventory' ? (
        <InventoryEmployeesPanel />
      ) : (
        <section className="max-w-2xl rounded border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Accounts employee management is not connected</h2>
          <p className="mt-2 text-sm text-slate-600">
            This checkout has no Accounts source or employee-management API. An Accounts auth backend exists on the separate <code>origin/accounts</code> branch, but it does not expose admin employee CRUD. No Accounts integration or authentication was changed.
          </p>
        </section>
      )}
      <Toast isOpen={showToast} message={toastMessage} type={toastType} onClose={() => setShowToast(false)} />
    </div>
  )
}
