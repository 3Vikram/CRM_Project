'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SearchableSelect } from '@/components/SearchableSelect'
import { fetchCompanyProfiles } from '@/lib/companyProfileApi'
import { createEmployee, defaultEmployeePermissions, fetchEmployeeById, fetchEmployees, updateEmployee, type EmployeePayload } from '@/lib/employeeApi'

const defaultCrudOptions = ['Create', 'Read', 'Update', 'Delete']
const defaultModuleOptions = [
  'Dashboard',
  'Contact',
  'Mail Campaign',
  'Lead',
  'Activity',
  'Calendar',
  'Customer',
  'Quotation',
  'Supplier',
  'Funnel',
  'OPF',
  'Renewals',
  'Report',
  'Data Admin',
  'Employees',
  'Company Profiles',
  'Inventory',
  'Purchase Orders',
  'DC Tracking',
  'Bill Sale',
]
const employeeTypeOptions = ['Select', 'Admin', 'Account', 'Manager', 'User']
const departmentOptions = ['Sales', 'Marketing', 'Operations', 'Support', 'Administration']

const formatArrayValues = (value: string[] | string | undefined) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  return value.split(',').map((entry) => entry.trim()).filter(Boolean)
}

const initialForm: EmployeePayload = {
  officialEmployeeId: '',
  employeeName: '',
  email: '',
  password: '',
  phone: '',
  contactNo: '',
  designation: '',
  department: 'Sales',
  role: 'Sales Executive',
  status: 'Active',
  joiningDate: '',
  dateOfJoin: '',
  dateOfBirth: '',
  employeeType: '',
  reportingTo: '',
  orderApprovalTo: '',
  branchCode: '',
  crudOption: [],
  modulesOption: [],
  permissions: defaultEmployeePermissions(),
}

interface MultiSelectDropdownProps {
  value: string[]
  options: string[]
  placeholder: string
  onChange: (nextValue: string[]) => void
}

function MultiSelectDropdown({ value, options, placeholder, onChange }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter((option) => {
    const matchesSearch = option.toLowerCase().includes(searchTerm.toLowerCase())
    const isSelected = value.includes(option)
    return matchesSearch && !isSelected
  })

  const toggleOption = (option: string) => {
    const nextValue = value.includes(option)
      ? value.filter((item) => item !== option)
      : [...value, option]
    onChange(nextValue)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex min-h-[42px] w-full flex-wrap items-center gap-1 rounded border border-[#D1D5DB] bg-white px-2 py-1.5 text-sm text-slate-700 focus-within:ring-2 focus-within:ring-slate-200">
        {value.length === 0 ? (
          <span className="px-1 text-xs text-slate-400">{placeholder}</span>
        ) : (
          value.map((option) => (
            <span key={option} className="inline-flex items-center gap-1 rounded border border-[#CBD5E1] bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
              {option}
              <button
                type="button"
                onClick={() => toggleOption(option)}
                className="ml-0.5 text-slate-500 hover:text-slate-700"
                aria-label={`Remove ${option}`}
              >
                ×
              </button>
            </span>
          ))
        )}
        <input
          value={searchTerm}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setSearchTerm(event.target.value)
            setIsOpen(true)
          }}
          placeholder={value.length ? '' : placeholder}
          className="min-w-[80px] flex-1 border-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto rounded border border-[#E5E7EB] bg-white shadow-lg">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">No matching option</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  toggleOption(option)
                  setSearchTerm('')
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {option}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function EmployeeFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<EmployeePayload>(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [employeeOptions, setEmployeeOptions] = useState<string[]>([])
  const [branchOptions, setBranchOptions] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [employeesResponse, companyProfilesResponse] = await Promise.all([
          fetchEmployees({ page: 1, limit: 1000 }),
          fetchCompanyProfiles({ page: 1, limit: 1000 }),
        ])

        const employeeNamesSet = new Set<string>()

        ;(employeesResponse?.data || []).forEach((employee: { employeeName?: string; fullName?: string }) => {
          const employeeName = String(employee.employeeName || employee.fullName || '').trim()
          if (employeeName) {
            employeeNamesSet.add(employeeName)
          }
        })

        setEmployeeOptions(Array.from(employeeNamesSet).sort((a, b) => a.localeCompare(b)))

        const branchMap = new Map<string, { value: string; label: string }>()

        ;(companyProfilesResponse?.data || []).forEach((profile: { branchCode?: string; branchName?: string }) => {
          const code = String(profile.branchCode || '').trim()
          const name = String(profile.branchName || '').trim()
          const label = code && name ? `${code} | ${name}` : code || name || ''

          if (!label) return

          branchMap.set(code || label, { value: code, label })
        })

        const branches: { value: string; label: string }[] = Array.from(branchMap.values()).sort((a, b) => a.label.localeCompare(b.label))
        setBranchOptions(branches)
      } catch {
        setEmployeeOptions([])
        setBranchOptions([])
      }
    }

    void loadReferenceData()
  }, [])

  useEffect(() => {
    if (!isEditing || !id) return

    const loadEmployee = async () => {
      const employee = await fetchEmployeeById(id)
      if (employee) {
        setForm({
          employeeCode: employee.employeeCode || employee.officialEmployeeId || '',
          officialEmployeeId: employee.officialEmployeeId || employee.employeeCode || '',
          employeeName: employee.employeeName || employee.fullName || '',
          email: employee.email || '',
          password: '',
          phone: employee.phone || employee.contactNo || '',
          contactNo: employee.contactNo || employee.phone || '',
          designation: employee.designation || '',
          department: employee.department || 'Sales',
          role: employee.role || 'Sales Executive',
          status: employee.status || 'Active',
          joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : '',
          dateOfJoin: employee.dateOfJoin ? new Date(employee.dateOfJoin).toISOString().slice(0, 10) : employee.joiningDate ? new Date(employee.joiningDate).toISOString().slice(0, 10) : '',
          dateOfBirth: employee.dateOfBirth ? new Date(employee.dateOfBirth).toISOString().slice(0, 10) : '',
          employeeType: employee.employeeType || '',
          reportingTo: employee.reportingTo || '',
          orderApprovalTo: employee.orderApprovalTo || '',
          branchCode: employee.branchCode || '',
          crudOption: employee.crudOption || [],
          modulesOption: employee.modulesOption || [],
          permissions: employee.permissions || defaultEmployeePermissions(),
        })
      }
    }

    void loadEmployee()
  }, [id, isEditing])

  const branchLabelValue = useMemo(
    () => branchOptions.find((option) => option.value === form.branchCode)?.label || '',
    [branchOptions, form.branchCode]
  )

  const handleChange = (field: keyof EmployeePayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleReset = () => {
    setForm({ ...initialForm, permissions: defaultEmployeePermissions() })
    setSubmitError(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.officialEmployeeId?.trim()) {
      setSubmitError('Official employee id is required.')
      return
    }

    if (!form.employeeName?.trim()) {
      setSubmitError('Full name is required.')
      return
    }

    if (!form.email?.trim()) {
      setSubmitError('Email is required.')
      return
    }

    if (!form.password?.trim()) {
      setSubmitError('Password is required.')
      return
    }

    const selectedCrudOptions = formatArrayValues(form.crudOption)
    const selectedModuleOptions = formatArrayValues(form.modulesOption)

    if (selectedCrudOptions.length === 0) {
      setSubmitError('Select at least one CRUD permission.')
      return
    }

    if (selectedModuleOptions.length === 0) {
      setSubmitError('Select at least one module permission.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const payload = {
        ...form,
        employeeCode: form.officialEmployeeId || form.employeeCode || '',
        officialEmployeeId: form.officialEmployeeId || form.employeeCode || '',
        employeeName: form.employeeName.trim(),
        fullName: form.employeeName.trim(),
        email: form.email.trim(),
        password: form.password.trim(),
        phone: form.phone?.trim() || form.contactNo?.trim() || '',
        contactNo: form.contactNo?.trim() || form.phone?.trim() || '',
        designation: form.designation?.trim() || '',
        department: form.department?.trim() || 'Sales',
        role: form.role?.trim() || 'Sales Executive',
        status: form.status || 'Active',
        joiningDate: form.dateOfJoin || form.joiningDate || '',
        dateOfJoin: form.dateOfJoin || form.joiningDate || '',
        dateOfBirth: form.dateOfBirth || '',
        employeeType: form.employeeType?.trim() || '',
        reportingTo: form.reportingTo?.trim() || '',
        orderApprovalTo: form.orderApprovalTo?.trim() || '',
        branchCode: form.branchCode?.trim() || '',
        crudOption: selectedCrudOptions,
        modulesOption: selectedModuleOptions,
        permissions: form.permissions ?? defaultEmployeePermissions(),
      }

      if (isEditing && id) {
        await updateEmployee(id, payload)
      } else {
        await createEmployee(payload)
      }

      navigate('/sales/employees')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to save employee.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => navigate('/sales/employees')}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]"
      >
        ← Back to Employee
      </button>

      <div className="border-b border-[#E5E7EB] pb-3">
        <h1 className="crm-page-heading">Input Employee Details</h1>
        {/* <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Insert</div> */}
      </div>

      <div className="rounded border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          {submitError ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</div> : null}

          <div className="grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Official Employee Id</span>
              <input value={form.officialEmployeeId || ''} onChange={(event) => handleChange('officialEmployeeId', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Full Name *</span>
              <input value={form.employeeName || ''} onChange={(event) => handleChange('employeeName', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Email *</span>
              <input type="email" value={form.email || ''} onChange={(event) => handleChange('email', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Password *</span>
              <input type="password" value={form.password || ''} onChange={(event) => handleChange('password', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Contact No</span>
              <input value={form.contactNo || form.phone || ''} onChange={(event) => handleChange('contactNo', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Designation</span>
              <input value={form.designation || ''} onChange={(event) => handleChange('designation', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Department</span>
              <select value={form.department || 'Sales'} onChange={(event) => handleChange('department', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200">
                {departmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Date of Join</span>
              <input type="date" value={form.dateOfJoin || form.joiningDate || ''} onChange={(event) => { handleChange('dateOfJoin', event.target.value); handleChange('joiningDate', event.target.value) }} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Date of Birth</span>
              <input type="date" value={form.dateOfBirth || ''} onChange={(event) => handleChange('dateOfBirth', event.target.value)} className="w-full rounded border border-[#D1D5DB] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200" />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Employee Type *</span>
              <SearchableSelect
                value={form.employeeType || ''}
                onChange={(value) => handleChange('employeeType', value === 'Select' ? '' : value)}
                options={employeeTypeOptions}
                placeholder="Select"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Reporting To *</span>
              <SearchableSelect
                value={form.reportingTo || ''}
                onChange={(value) => handleChange('reportingTo', value === 'Select' ? '' : value)}
                options={employeeOptions}
                placeholder="Select employee"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Order Approval To</span>
              <SearchableSelect
                value={form.orderApprovalTo || ''}
                onChange={(value) => handleChange('orderApprovalTo', value === 'Select' ? '' : value)}
                options={employeeOptions}
                placeholder="Select employee"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-600">Branch Code *</span>
              <SearchableSelect
                value={branchLabelValue}
                onChange={(value) => {
                  const match = branchOptions.find((option) => option.label === value)
                  handleChange('branchCode', match?.value || '')
                }}
                options={branchOptions.map((option) => option.label)}
                placeholder="Select branch"
              />
            </label>

            <div className="rounded border border-[#E5E7EB] bg-[#F8FAFC] p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">CRUD Option *</div>
              <MultiSelectDropdown
                value={formatArrayValues(form.crudOption)}
                options={defaultCrudOptions}
                placeholder="Select CRUD"
                onChange={(nextValue) => setForm((prev) => ({ ...prev, crudOption: nextValue }))}
              />
            </div>

            <div className="rounded border border-[#E5E7EB] bg-[#F8FAFC] p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Modules Option *</div>
              <MultiSelectDropdown
                value={formatArrayValues(form.modulesOption)}
                options={defaultModuleOptions}
                placeholder="Select modules"
                onChange={(nextValue) => setForm((prev) => ({ ...prev, modulesOption: nextValue }))}
              />
            </div>

            <div />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#E5E7EB] pt-3">
            <button type="button" onClick={handleReset} className="rounded border border-[#D1D5DB] bg-white px-4 py-2 text-sm font-semibold text-slate-700">Reset</button>
            <button type="submit" disabled={isSubmitting} className="rounded bg-[#0F172A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1E293B] disabled:opacity-60">
              {isSubmitting ? 'Saving...' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
