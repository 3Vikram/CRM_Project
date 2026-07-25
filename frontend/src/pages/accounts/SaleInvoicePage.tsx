'use client'

import { useEffect, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import {
  ExcelDropzone,
} from '@/components/accounts/sale-invoice/ExcelDropzone'
import { LineItemsTable } from '@/components/accounts/sale-invoice/LineItemsTable'
import type { LineItem } from '@crm/shared'

/**
 * Sale Invoice generator screen (Accounts module).
 *
 * v1 shape from the PRD: left = collapsible controls panel, right = sticky
 * live preview. This slice (ISSUE-02) wires the dropzone + flat editable
 * review table. Preview + compute + toggles arrive in ISSUE-03 and onward.
 */
export default function SaleInvoicePage() {
  const [rows, setRows] = useState<LineItem[]>([])
  const [fileName, setFileName] = useState<string | null>(null)

  // ISSUE-09 localStorage autosave resilience will hook here; for now just the
  // table. Kept as a no-op to make the action bar visible & honest.
  useEffect(() => {
    /* placeholder for autosave in ISSUE-09 */
  }, [rows, fileName])

  const handleReset = () => {
    setRows([])
    setFileName(null)
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-1">
            Sale Invoice
          </h1>
          <p className="text-gray-600 text-sm">
            Drop the rental ledger, review the rows, then generate a GST invoice
            matching the Flatworld / SYNOV layout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 text-white text-sm font-medium opacity-40 cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Dropzone */}
      {rows.length === 0 ? (
        <ExcelDropzone
          onRows={(parsed, name) => {
            setRows(parsed)
            setFileName(name)
          }}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{fileName}</span>{' '}
              <span className="text-gray-400">·</span> {rows.length} rows
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              Drop a different file
            </button>
          </div>
          <LineItemsTable rows={rows} onChange={setRows} />
        </div>
      )}
    </div>
  )
}