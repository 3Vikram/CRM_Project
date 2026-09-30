'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Plus, Download, Eye, Pencil, Trash2, Building2 } from 'lucide-react'
import { Modal } from '@/components/modal'
import { Toast } from '@/components/toast'
import { deleteSupplier, fetchSuppliers, type SupplierRecord } from '@/lib/supplierApi'
import { clearApiCache } from '@/lib/apiCache'

const tableCellClass = 'px-6 py-3 border-r border-[#D1D5DB]'

export default function SuppliersPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [productFilter, setProductFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null)
  const [pendingDeleteSupplier, setPendingDeleteSupplier] = useState<SupplierRecord | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success')
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const searchTimeoutRef = useRef<number | null>(null)

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message)
    setToastType(type)
    setShowToast(true)
  }, [])

  const loadSuppliers = useCallback(async (nextPage = page, nextLimit = pageSize, query = searchQuery, product = productFilter) => {
    setIsLoading(true)
    try {
      const response = await fetchSuppliers({ search: query, product: product === 'all' ? '' : product, page: nextPage, limit: nextLimit })
      setSuppliers(response.data || [])
      setTotalPages(response.pagination?.totalPages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to load suppliers', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [notify, page, pageSize, searchQuery, productFilter])

  useEffect(() => {
    if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = window.setTimeout(() => {
      void loadSuppliers(page, pageSize, searchQuery, productFilter)
    }, 500)

    return () => {
      if (searchTimeoutRef.current) window.clearTimeout(searchTimeoutRef.current)
    }
  }, [page, pageSize, searchQuery, productFilter, loadSuppliers])

  useEffect(() => {
    if (location.state?.message) {
      setFeedbackMessage(location.state.message)
      window.history.replaceState({}, '', location.pathname)
    }
  }, [location.pathname, location.state])

  const productOptions = useMemo(() => Array.from(new Set(suppliers.map((supplier) => supplier.product).filter(Boolean))).sort(), [suppliers])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, productFilter, pageSize])

  const handleAddNew = () => navigate('/sales/suppliers/new')
  const handleEdit = (supplier: SupplierRecord) => navigate(`/sales/suppliers/edit/${supplier._id}`)
  const handleView = (supplier: SupplierRecord) => setSelectedSupplier(supplier)

  const handleDelete = async () => {
    if (!pendingDeleteSupplier) return
    setIsDeleting(true)
    try {
      await deleteSupplier(pendingDeleteSupplier._id)
      clearApiCache()
      setPendingDeleteSupplier(null)
      setSelectedSupplier(null)
      await loadSuppliers(page, pageSize, searchQuery, productFilter)
      notify('Supplier deleted successfully')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to delete supplier', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownloadReport = () => {
    const rows = suppliers.map((supplier) => [
      supplier.supplierName,
      supplier.contactName,
      supplier.emailId,
      supplier.contactNumber,
      supplier.product,
      supplier.createdBy || 'Admin',
    ])

    const csv = [
      ['Supplier Name', 'Contact Name', 'Email', 'Contact Number', 'Product', 'Created By'],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'supplier-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">Supplier List</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={handleAddNew} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B]">
            <Plus className="h-4 w-4" />
            ADD NEW
          </button>
          <button onClick={handleDownloadReport} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-[#E7E3DA]">
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search"
              className="w-full rounded-lg border border-[#EFECE5] bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>
        </div>
      </div>

      {feedbackMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{feedbackMessage}</div>
      ) : null}

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="mb-4">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Product Filter</span>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="w-full max-w-xs rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]">
              <option value="all">All Products</option>
              {productOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="overflow-hidden rounded-lg border border-[#EFECE5]">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-[#F2EFE8]" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#EFECE5] bg-[#F2EFE8]">
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Supplier ID</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Created By</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Supplier Name</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Contact Name</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Contact Email</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Contact Number</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Product</th>
                    <th className={tableCellClass + ' text-left text-xs font-semibold uppercase tracking-wider text-gray-600'}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.length > 0 ? (
                    suppliers.map((supplier) => (
                      <tr key={supplier._id} className="border-b border-[#F2EFE8] transition-colors hover:bg-[#F2EFE8]">
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm font-semibold text-gray-900`}>{supplier.supplierId}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{supplier.createdBy || 'Admin'}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{supplier.supplierName}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{supplier.contactName}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{supplier.emailId}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{supplier.contactNumber}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{supplier.product}</td>
                        <td className={`${tableCellClass.replace('py-3','py-4')}`}>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleView(supplier)} className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]" title="View">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => handleEdit(supplier)} className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => setPendingDeleteSupplier(supplier)} className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 transition hover:bg-[#F2EFE8]" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-6 py-16 text-center text-gray-500 border-r border-[#D1D5DB]">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Building2 className="h-8 w-8 text-gray-300" />
                          <p>No suppliers found.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select className="rounded border border-[#EFECE5] bg-white px-2 py-1.5 text-sm text-gray-700" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="text-sm text-gray-500">Showing {(totalCount === 0 ? 0 : (page - 1) * pageSize + 1)} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries</div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
      </div>

      <Modal isOpen={Boolean(selectedSupplier)} onClose={() => setSelectedSupplier(null)} title={selectedSupplier?.supplierName || ''}>
        {selectedSupplier ? (
          <div className="space-y-4">
            <div className="grid gap-3 text-sm text-slate-700">
              <div><span className="font-semibold text-slate-600">Supplier Name:</span> {selectedSupplier.supplierName}</div>
              <div><span className="font-semibold text-slate-600">Category:</span> {selectedSupplier.category}</div>
              <div><span className="font-semibold text-slate-600">Payment Terms:</span> {selectedSupplier.paymentTerms}</div>
              <div><span className="font-semibold text-slate-600">Contact Person:</span> {selectedSupplier.contactName}</div>
              <div><span className="font-semibold text-slate-600">Email:</span> {selectedSupplier.emailId}</div>
              <div><span className="font-semibold text-slate-600">Phone:</span> {selectedSupplier.contactNumber}</div>
              <div><span className="font-semibold text-slate-600">Product:</span> {selectedSupplier.product}</div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#EFECE5] pt-4">
              <button onClick={() => handleEdit(selectedSupplier)} className="rounded bg-[#111827] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1E293B]">Edit Supplier</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(pendingDeleteSupplier)}
        onClose={() => !isDeleting && setPendingDeleteSupplier(null)}
        title="Delete Supplier"
        footer={(
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setPendingDeleteSupplier(null)} disabled={isDeleting} className="rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      >
        <p className="text-sm text-gray-700">Are you sure to delete this supplier?</p>
      </Modal>

      {showToast ? <Toast message={toastMessage} type={toastType} onClose={() => setShowToast(false)} /> : null}
    </div>
  )
}
