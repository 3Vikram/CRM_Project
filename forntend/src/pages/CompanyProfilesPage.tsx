'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react'
import { deleteCompanyProfile, fetchCompanyProfiles, type CompanyProfileRecord } from '@/lib/companyProfileApi'

const PAGE_SIZE = 20

export default function CompanyProfilesPage() {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState<CompanyProfileRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProfiles = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetchCompanyProfiles({ search: searchQuery, page, limit: PAGE_SIZE })
        setProfiles(response.data)
        setTotalPages(response.pagination?.totalPages || 1)
        setTotalCount(response.pagination?.total || 0)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load company profiles')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfiles()
  }, [page, searchQuery])

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'No profiles found.'
    const start = (page - 1) * PAGE_SIZE + 1
    const end = Math.min(page * PAGE_SIZE, totalCount)
    return `Showing ${start} to ${end} of ${totalCount} profiles`
  }, [page, totalCount])

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this company profile?')) return
    try {
      await deleteCompanyProfile(id)
      setProfiles((prev) => prev.filter((item) => item._id !== id))
      setTotalCount((prev) => Math.max(prev - 1, 0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete company profile')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-heading">Company Details
            
          </h1>
          {/* <p className="text-gray-600">View all saved company profiles and quotation integration settings.</p> */}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => navigate('/sales/company-profiles/new')} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1E293B]">
            <Plus className="h-4 w-4" />
            Add New
          </button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => { setSearchQuery(event.target.value); setPage(1) }}
              placeholder="Search by company or director"
              className="w-full rounded-lg border border-[#EFECE5] bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-4">{error}</div> : null}

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-600">{summaryText}</div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {isLoading ? 'Loading...' : null}
          </div>
        </div>

        <div className="overflow-x-auto overflow-y-hidden rounded-lg border border-[#E5E7EB] bg-white">
          <table className="min-w-[4200px] table-fixed border-collapse text-xs text-gray-700">
            <thead className="bg-[#F8F7F3] text-left uppercase tracking-wider text-gray-600">
              <tr>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Director Name</th>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Director Designation</th>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Company Name</th>
                <th className="w-[160px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Branch Name</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Branch Code</th>
                <th className="w-[220px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Registered Address</th>
                <th className="w-[220px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Address</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">City</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">State</th>
                <th className="w-[100px] border border-[#D1D5DB] px-3 py-3 align-top break-words">PIN</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Country</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Contact No.</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Website</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">GST No.</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">PAN No.</th>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Bank Name</th>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Account Holder Name</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Account No.</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">IFSC Code</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Swift Code</th>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Email</th>
                <th className="w-[180px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Quotation Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">ID No. Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">OPF Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">PO Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">PI Format</th>
                <th className="w-[160px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Invoice Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">PR Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Enquiry Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Challan Format</th>
                <th className="w-[140px] border border-[#D1D5DB] px-3 py-3 align-top break-words">CIN</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">IEC</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Update</th>
                <th className="w-[120px] border border-[#D1D5DB] px-3 py-3 align-top break-words">Remove</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile._id} className="border-t border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]">
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5 text-slate-900">{profile.directorName || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.directorDesignation || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.companyName || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.branchName || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.branchCode || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.registeredAddress || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.address || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.city || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.state || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.pin || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.country || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.companyContactNo || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.website || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.gstNo || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.panNo || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.bankName || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.accountHolderName || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.accountNo || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.ifscCode || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.swiftCode || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.email || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.quotationFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.idNoFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.opfFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.poFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.piFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.invoiceFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.prFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.enquiryFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.challanFormat || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.cin || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">{profile.iec || '-'}</td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">
                    <button onClick={() => navigate(`/sales/company-profiles/edit/${profile._id}`)} className="inline-flex items-center justify-center rounded-lg bg-[#F2EFE8] px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-[#E7E3DA]">
                      Edit
                    </button>
                  </td>
                  <td className="border border-[#E5E7EB] px-3 py-2 align-top text-[11px] leading-5">
                    <button onClick={() => handleDelete(profile._id)} className="inline-flex items-center justify-center rounded-lg bg-[#FEF2F2] px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-[#FEE2E2]">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {profiles.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                    No company profiles found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <div>{`Page ${page} of ${totalPages}`}</div>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={page >= totalPages}
              className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
