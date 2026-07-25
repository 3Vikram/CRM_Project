'use client'

import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileSpreadsheet } from 'lucide-react'
import { rowsFromWorkbook, WorkbookParseError } from '@/lib/rowsFromWorkbook'
import type { LineItem } from '@crm/shared'

interface Props {
  onRows: (rows: LineItem[], fileName: string) => void
}

/**
 * Privacy-first dropzone: reads `.xlsx` entirely in the browser with SheetJS
 * and produces `LineItem[]` via the pure `rowsFromWorkbook` module. The file
 * is never uploaded to the backend (no network call on drop).
 */
export function ExcelDropzone({ onRows }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      if (!/\.xlsx$/i.test(file.name)) {
        setError('Please drop a valid .xlsx rental ledger.')
        return
      }
      setBusy(true)
      try {
        const buf = await file.arrayBuffer()
        const rows = rowsFromWorkbook(new Uint8Array(buf))
        onRows(rows, file.name)
      } catch (e) {
        if (e instanceof WorkbookParseError) setError(e.message)
        else setError('Could not parse this workbook. Pick the rental ledger .xlsx.')
      } finally {
        setBusy(false)
      }
    },
    [onRows],
  )

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) void handleFile(f)
        }}
        className={`cursor-pointer w-full border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center transition-colors ${
          dragging
            ? 'border-gray-900 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
        }`}
      >
        <div className="w-12 h-12 rounded-full bg-[#F2EFE8] flex items-center justify-center mb-3">
          {busy ? (
            <FileSpreadsheet className="w-6 h-6 text-gray-600 animate-pulse" />
          ) : (
            <UploadCloud className="w-6 h-6 text-gray-600" />
          )}
        </div>
        <p className="text-sm font-medium text-gray-900">
          Drop the rental <code className="text-gray-700">.xlsx</code> here
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Parsed in your browser — the file never leaves this machine.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}