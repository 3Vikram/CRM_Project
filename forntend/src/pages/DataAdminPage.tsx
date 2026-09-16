'use client'

import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { importContacts } from '@/lib/contactApi'

export default function DataAdminPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose an Excel file.')
      return
    }

    setIsUploading(true)
    setMessage('')
    setError('')
    try {
      const result = await importContacts(file)
      setMessage(result.message)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to import contacts.')
    } finally {
      setIsUploading(false)
    }
  }

  const downloadSample = () => {
    const sample = 'Contact Name,Designation,Phone Number,Email\nExample Contact,Manager,9876543210,example@example.com\n'
    const url = URL.createObjectURL(new Blob([sample], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'contacts-sample.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const saveExcelFile = () => {
    if (!file) {
      setError('Please choose an Excel file first.')
      return
    }

    const url = URL.createObjectURL(file)
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="crm-page-heading">Data Admin</h1>
      </div>

      <section className="w-full max-w-4xl rounded-lg border border-[#EFECE5] bg-white p-8 font-['Times_New_Roman',Times,serif]">
        <h2 className="mb-8 text-xl font-semibold text-[#111827]">Upload Contacts Detail</h2>

        {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div>
            <h3 className="mb-4 text-lg font-semibold text-green-700">Upload</h3>
            <div className="flex items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} className="w-auto text-sm text-gray-700 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:text-gray-700" />
              <button type="button" onClick={() => void handleUpload()} disabled={isUploading} className="inline-flex shrink-0 items-center justify-center rounded bg-[#111827] p-2.5 text-white hover:bg-[#1E293B] disabled:opacity-60" aria-label={isUploading ? 'Uploading' : 'Upload'} title={isUploading ? 'Uploading' : 'Upload'}>
                <Upload className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-red-600">*csv format only acceptable</p>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold text-green-700">Download</h3>
            <div className="flex items-center gap-5">
              <span className="text-sm text-gray-700">Download Sample File (.csv)</span>
              <button type="button" onClick={downloadSample} className="inline-flex shrink-0 items-center justify-center rounded bg-[#6D28D9] p-2.5 text-white" aria-label="Download sample file" title="Download sample file">
                <Download className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-red-600">*Upload Maximum 500 Row</p>
          </div>
        </div>
      </section>
    </div>
  )
}
