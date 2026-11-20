'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, MessageCircle, UsersRound, UserRoundPlus } from 'lucide-react'
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, Tooltip } from '@mui/material'
import { deleteContact, fetchContacts, fetchEmployeeBatchGroups, moveContactToCustomer, type ContactRecord, type EmployeeBatchGroup } from '@/sales/lib/contactApi'
import { PermissionGate } from '@/sales/components/PermissionGate'
import { ActionMenu } from '@/sales/components/ActionMenu'
import { PageFilters, type PageFilterField, type PageFilterValues } from '@/sales/components/PageFilters'

const PAGE_SIZE = 20
const CONTACTS_FETCH_PAGE_SIZE = 100
const tableCellClass = 'border-r border-[#E1E4EA] px-4 py-3'

const fetchAllContacts = async (filters: { employeeId?: string; batchId?: string }) => {
  const firstPage = await fetchContacts({ ...filters, page: 1, limit: CONTACTS_FETCH_PAGE_SIZE })
  const contacts = [...(firstPage.data || [])]
  const totalPages = firstPage.pagination?.totalPages || 1

  for (let page = 2; page <= totalPages; page += 1) {
    const response = await fetchContacts({ ...filters, page, limit: CONTACTS_FETCH_PAGE_SIZE })
    contacts.push(...(response.data || []))
  }

  return contacts
}

const getDateFilterValue = (value?: string | null) => {
  if (!value) return ''
  const datePrefix = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
  if (datePrefix) return datePrefix
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function ContactsPage() {
  const navigate = useNavigate()
  const [allContacts, setAllContacts] = useState<ContactRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<PageFilterValues>({})
  const [employeeGroups, setEmployeeGroups] = useState<EmployeeBatchGroup[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      const contacts = await fetchAllContacts({
        employeeId: selectedEmployeeId || undefined,
        batchId: batchId || undefined,
      })
      setAllContacts(contacts)
      setLoadError(null)
    } catch (error) {
      setAllContacts([])
      setLoadError(error instanceof Error ? error.message : 'Unable to load contacts.')
    } finally {
      setIsLoading(false)
    }
  }, [batchId, selectedEmployeeId])

  useEffect(() => {
    let active = true
    fetchEmployeeBatchGroups()
      .then((groups) => {
        if (active) setEmployeeGroups(groups)
      })
      .catch((error) => {
        if (active) setFeedbackMessage(error instanceof Error ? error.message : 'Unable to load contact batches.')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  const employeeIdsByName = useMemo(
    () => new Map(employeeGroups.map((group): [string, string] => [group.employeeName, group.employeeId])),
    [employeeGroups],
  )

  const filterFields = useMemo<PageFilterField[]>(() => [
    { key: 'employeeName', label: 'Employee', type: 'select', options: Array.from(new Set([
      ...allContacts.map((contact) => contact.employeeName),
      ...employeeGroups.map((group) => group.employeeName),
    ].filter((value): value is string => Boolean(value)))).sort() },
    { key: 'customerName', label: 'Customer Name', type: 'select', options: Array.from(new Set(allContacts.map((contact) => contact.customerName).filter((value): value is string => Boolean(value)))).sort() },
    { key: 'designation', label: 'Designation', type: 'select', options: Array.from(new Set(allContacts.map((contact) => contact.designation).filter(Boolean))).sort() },
    { key: 'createdAt', label: 'Created Date', type: 'date' },
  ], [allContacts, employeeGroups])

  const filteredContacts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    return allContacts.filter((contact) => {
      if (filters.employeeName) {
        const employeeId = employeeIdsByName.get(filters.employeeName)
        if (contact.employeeName !== filters.employeeName && (!employeeId || contact.employeeId !== employeeId)) return false
      }
      if (filters.customerName && (contact.customerName || '') !== filters.customerName) return false
      if (filters.designation && (contact.designation || '') !== filters.designation) return false
      if (filters.createdAt && getDateFilterValue(contact.createdAt) !== filters.createdAt) return false
      if (!normalizedQuery) return true
      return [
        contact.customerName,
        contact.contactName,
        contact.designation,
        contact.contactNumber,
        contact.email,
      ].some((value) => String(value ?? '').toLowerCase().startsWith(normalizedQuery))
    })
  }, [allContacts, searchQuery, filters, employeeIdsByName])

  const totalCount = filteredContacts.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const contacts = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredContacts.slice(startIndex, startIndex + pageSize)
  }, [filteredContacts, page, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'Showing 0 to 0 of 0 entries'
    return `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} entries`
  }, [page, pageSize, totalCount])

  const contactCounts = useMemo(() => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const newThisMonth = allContacts.filter((contact) => {
      if (!contact.createdAt) return false
      const createdAt = new Date(contact.createdAt)
      return !Number.isNaN(createdAt.getTime()) && createdAt >= monthStart
    }).length

    return {
      total: allContacts.length,
      newThisMonth,
    }
  }, [allContacts])

  const summaryCards = [
    { label: 'TOTAL CONTACTS', value: isLoading ? '—' : contactCounts.total, icon: UsersRound, color: '#3867E8', background: '#EAF0FF' },
    { label: 'NEW CONTACTS (THIS MONTH)', value: isLoading ? '—' : contactCounts.newThisMonth, icon: UserRoundPlus, color: '#F5A623', background: '#FFF4E1' },
  ]

  const handleDelete = useCallback(async (id: string) => {
    if (!id) return

    try {
      await deleteContact(id)
      await loadContacts()
      setFeedbackMessage('Contact deleted successfully.')
    } catch (error) {
      console.error(error)
      const backendMessage = error instanceof Error ? error.message : 'Failed to delete contact.'
      setFeedbackMessage(backendMessage)
    } finally {
      setDeleteTargetId(null)
    }
  }, [loadContacts])

  const handleMoveToCustomer = useCallback(async (contactId: string) => {
    try {
      const response = await moveContactToCustomer(contactId)
      const customerId = response?.data?.customer?._id
      navigate(customerId ? `/customers/edit/${customerId}` : '/sales/customers')
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : 'Failed to move contact to customer.')
    }
  }, [navigate])

  return (
    <div className="contacts-page space-y-5">
      <style>{`
        .sales-module-typography .contacts-page .crm-page-heading {
          font-size: 28px !important;
        }
        .sales-module-typography .contacts-page .contacts-control {
          color: #344054 !important;
          font-size: 14px !important;
        }
        .sales-module-typography .contacts-page .contacts-add-button,
        .sales-module-typography .contacts-page .contacts-add-button:hover,
        .sales-module-typography .contacts-page .contacts-add-button:focus,
        .sales-module-typography .contacts-page .contacts-add-button:focus-visible,
        .sales-module-typography .contacts-page .contacts-add-button:disabled {
          background-color: #172640 !important;
          color: #FFFFFF !important;
          font-size: 14px !important;
          font-weight: 600 !important;
        }
        .sales-module-typography .contacts-page .contacts-add-button:hover {
          background-color: #233958 !important;
        }
        .sales-module-typography .contacts-page .contacts-add-button:disabled {
          opacity: 0.6;
        }
        .sales-module-typography .contacts-page .contacts-add-button svg {
          color: #FFFFFF !important;
        }
        .sales-module-typography .contacts-page .contacts-table tbody td {
          color: #344054 !important;
          font-size: 14px !important;
        }
      `}</style>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="shrink-0">
          <h1 className="crm-page-heading">Contacts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 xl:justify-end">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search Contacts"
              className="contacts-control w-full rounded-lg border border-[#E1E4EA] bg-white py-2 pl-9 pr-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7663A8]/30"
            />
          </div>
          <select value={batchId ? `${selectedEmployeeId}:${batchId}` : ''} onChange={(event) => {
            const [nextEmployeeId = '', nextBatchId = ''] = event.target.value.split(':')
            setSelectedEmployeeId(nextEmployeeId)
            setBatchId(nextBatchId)
            setPage(1)
          }} className="contacts-control min-w-40 rounded-lg border border-[#E1E4EA] bg-white px-3 py-2">
            <option value="">All Batches</option>
            {employeeGroups.map((group) => (
              <optgroup key={group.employeeId} label={group.employeeName}>
                {group.batches.filter((batch) => batch._id && batch.employeeId).map((batch) => (
                  <option key={batch._id} value={`${batch.employeeId}:${batch._id}`}>{batch.name} ({batch.customerCount})</option>
                ))}
              </optgroup>
            ))}
          </select>
          <PageFilters
            fields={filterFields}
            values={filters}
            onApply={(values) => { setFilters(values); setPage(1) }}
            onClear={() => { setFilters({}); setPage(1) }}
          />
          <PermissionGate moduleName="contacts" action="create">
            <button onClick={() => navigate('/sales/contacts/new')} className="contacts-control contacts-add-button flex items-center gap-2 rounded-lg bg-[#172640] px-4 py-2 font-semibold text-white transition hover:bg-[#233958] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7663A8] disabled:cursor-not-allowed">
              <Plus className="h-4 w-4" />
              ADD NEW
            </button>
          </PermissionGate>
        </div>
      </div>

      <div
        className="grid w-full grid-cols-2 gap-4"
        style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
      >
        {summaryCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="sales-summary-card flex w-full items-center gap-3">
              <div className="sales-summary-card-icon shrink-0" style={{ backgroundColor: card.background, color: card.color }}>
                <Icon aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="sales-summary-card-value">{card.value}</div>
                <div className="sales-summary-card-label mt-0.5">{card.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {feedbackMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedbackMessage}
        </div>
      ) : null}

      {loadError ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Unable to load contacts: {loadError}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-[#E1E4EA] bg-white shadow-sm">
        <div className="overflow-hidden">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-[#F2EFE8]" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="sales-data-table contacts-table w-full min-w-[1050px] border-collapse text-left">
                <colgroup>
                  <col className="w-[7%]" />
                  <col className="w-[17%]" />
                  <col className="w-[17%]" />
                  <col className="w-[15%]" />
                  <col className="w-[15%]" />
                  <col className="w-[21%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead>
                  <tr>
                    <th className={`${tableCellClass} border-b py-3 font-bold`}>SL. NO</th>
                    <th className={`${tableCellClass} border-b py-3 font-bold`}>CUSTOMER NAME</th>
                    <th className={`${tableCellClass} border-b py-3 font-bold`}>CONTACT NAME</th>
                    <th className={`${tableCellClass} border-b py-3 font-bold`}>DESIGNATION</th>
                    <th className={`${tableCellClass} border-b py-3 font-bold`}>PHONE NUMBER</th>
                    <th className={`${tableCellClass} border-b py-3 font-bold`}>EMAIL</th>
                    <th className={`${tableCellClass} border-b py-3 text-center font-bold`}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length > 0 ? (
                    contacts.map((contact, index) => {
                      const serialNumber = (page - 1) * pageSize + index + 1
                      return (
                        <ContactTableRow
                          key={`${contact._id || 'contact'}-${index}`}
                          serialNumber={serialNumber}
                          contact={contact}
                          onEdit={(id) => navigate(`/sales/contacts/edit/${id}`)}
                          onDelete={setDeleteTargetId}
                          onMoveToCustomer={() => void handleMoveToCustomer(contact._id)}
                          onView={setSelectedContact}
                        />
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="border-r border-[#E1E4EA] px-6 py-16 text-center text-gray-500">
                        {loadError ? 'Contacts could not be loaded.' : 'No contacts found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E1E4EA] px-4 py-3">
          <div className="contacts-control flex items-center gap-2 text-gray-500">
            <span>Show</span>
            <select className="contacts-control rounded border border-[#E1E4EA] bg-white px-2 py-1.5" value={pageSize} onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="contacts-control text-gray-500">{summaryText}</div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-[#E1E4EA] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="contacts-control text-gray-600">Page {page} of {totalPages}</span>
            <button className="rounded border border-[#E1E4EA] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(selectedContact)} onClose={() => setSelectedContact(null)}>
        <DialogTitle>{selectedContact?.contactName || 'Contact Details'}</DialogTitle>
        <DialogContent>
          <div className="grid gap-3 text-sm text-gray-700">
            <div><strong>Customer:</strong> {selectedContact?.customerName || '-'}</div>
            <div><strong>Contact Person:</strong> {selectedContact?.contactName || '-'}</div>
            <div><strong>Designation:</strong> {selectedContact?.designation || '-'}</div>
            <div><strong>Phone:</strong> {selectedContact?.contactNumber || '-'}</div>
            <div><strong>Email:</strong> {selectedContact?.email || '-'}</div>
          </div>
        </DialogContent>
        <DialogActions><Button onClick={() => setSelectedContact(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTargetId)} onClose={() => setDeleteTargetId(null)}>
        <DialogTitle>Delete contact</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this contact?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTargetId(null)}>Cancel</Button>
          <Button color="error" onClick={() => deleteTargetId && void handleDelete(deleteTargetId)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

const ContactTableRow = memo(function ContactTableRow({
  serialNumber,
  contact,
  onEdit,
  onDelete,
  onMoveToCustomer,
  onView,
}: {
  serialNumber: number
  contact: ContactRecord
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onMoveToCustomer: () => void
  onView: (contact: ContactRecord) => void
}) {
  const normalizeDigits = (value = '') => String(value).replace(/\D/g, '')
  const digits = normalizeDigits(contact.contactNumber || '')
  const hasValidPhone = digits.length >= 10
  const openWhatsApp = () => {
    if (!hasValidPhone) return
    const waNumber = digits.length === 10 ? `91${digits}` : digits
    window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
    <tr className="border-b border-[#E1E4EA] bg-white transition-colors hover:bg-[#F8FAFC]">
      <td className={`${tableCellClass.replace('py-3','py-4')} text-[18px] text-gray-700`}>{serialNumber}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-[18px] text-gray-700`}>{contact.customerName || '-'}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-[18px] text-gray-700`}>{contact.contactName}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-[18px] text-gray-700`}>{contact.designation}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-[18px] text-gray-700`}>
        <span className="inline-flex items-center">
          <span>{contact.contactNumber}</span>
          <Tooltip title={hasValidPhone ? 'Open WhatsApp' : 'Phone number not available.'} arrow>
            <span>
              <button
                type="button"
                onClick={openWhatsApp}
                disabled={!hasValidPhone}
                className="inline-flex items-center ml-2 rounded p-1 text-[#25D366] hover:bg-[#F2EFE8] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={hasValidPhone ? 'Open WhatsApp' : 'Phone number not available.'}
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </span>
          </Tooltip>
        </span>
      </td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-[18px] text-gray-700`}>{contact.email}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-center`}>
        <ActionMenu moduleName="contacts" onView={() => onView(contact)} onEdit={() => onEdit(contact._id)} onDelete={() => onDelete(contact._id)}>
          {(closeMenu) => <button type="button" role="menuitem" onClick={() => { closeMenu(); onMoveToCustomer() }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-[#F2EFE8]">Move to Customer</button>}
        </ActionMenu>
      </td>
    </tr>
    </>
  )
})
