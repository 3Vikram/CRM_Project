'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, RotateCcw } from 'lucide-react'
import type { Entity, LineItem } from '@crm/shared'
import { fetchEntities, computeInvoice, ComputationError } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { ExcelDropzone } from '@/components/accounts/sale-invoice/ExcelDropzone'
import { ControlsPanel } from '@/components/accounts/sale-invoice/ControlsPanel'
import { InvoicePreview } from '@/components/accounts/sale-invoice/preview/InvoicePreview'
import {
  DraftProvider,
  useDraft,
  clearStoredDraft,
} from './sale-invoice/draft-context'

function pickSellerFromRows(rows: LineItem[], entities: Entity[]): Entity {
  const counts: Record<string, number> = {}
  for (const r of rows) {
    if (!r.company) continue
    counts[r.company] = (counts[r.company] ?? 0) + 1
  }
  const majority = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (majority === '3VIKRAM') return entities.find((e) => e.id === '3vikram')!
  if (majority === 'SYNOV') return entities.find((e) => e.id === 'synov')!
  return entities[0] ?? entities[0]
}

function SaleInvoiceInner() {
  const { draft, dispatch } = useDraft()
  const [entities, setEntities] = useState<Entity[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [computed, setComputed] = useState<import('@crm/shared').ComputedInvoice | null>(null)
  const [compErr, setCompErr] = useState<string | null>(null)
  const [computing, setComputing] = useState(false)
  const [, forceTick] = useState(0)

  // load seller presets once
  useEffect(() => {
    let cancelled = false
    fetchEntities()
      .then((e) => {
        if (cancelled) return
        setEntities(e)
        // ensure draft has a valid seller for compute from the start
        if (!e.find((x) => x.id === draft.sellerId)) {
          dispatch({ type: 'SET_SELLER', entity: e[0] })
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadErr(err instanceof Error ? err.message : 'failed')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const debouncedDraft = useDebounced(draft, 350)

  // recompute on every meaningful edit (debounced)
  useEffect(() => {
    if (draft.lines.length === 0) {
      setComputed(null)
      return
    }
    let cancelled = false
    setComputing(true)
    setCompErr(null)
    computeInvoice(debouncedDraft)
      .then((c) => {
        if (cancelled) return
        setComputed(c)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ComputationError)
          setCompErr(`${err.message}` + (err.issues.length ? ' — see console' : ''))
        else setCompErr((err as Error).message)
      })
      .finally(() => {
        if (cancelled) return
        setComputing(false)
        forceTick((n) => n + 1)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedDraft])

  const hasRows = draft.lines.length > 0

  const handleDrop = (rows: LineItem[]) => {
    const seller = pickSellerFromRows(rows, entities)
    dispatch({ type: 'SET_LINES_AND_SELLER', lines: rows, entity: seller })
  }

  const handleReset = () => {
    clearStoredDraft()
    dispatch({ type: 'RESET', seller: entities[0] })
    setComputed(null)
    setCompErr(null)
  }

  const mixedCompany = useMemo(() => {
    const companies = new Set(draft.lines.map((l) => l.company).filter(Boolean))
    return companies.size > 1
  }, [draft.lines])

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
            disabled={!computed}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800"
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

      {loadErr && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          Could not load seller presets from /api/entities: {loadErr}. Is the
          backend running on port 4000?
        </div>
      )}
      {mixedCompany && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          <div className="font-semibold">
            The dropped rows contain mixed <code>COMPANY</code> values — split
            into two invoices before generating.
          </div>
          {computed?.mixedCompany && computed?.companyBreakdown && (
            <div className="mt-1 text-xs">
              {computed.companyBreakdown.map((c) => `${c.company}: ${c.count}`).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* Split-pane: controls | preview */}
      {!hasRows ? (
        <ExcelDropzonePreview onDrop={handleDrop} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,540px),minmax(0,1fr)] gap-6 items-start">
          <div className="controls-panel">
            <ControlsPanel entities={entities} />
          </div>
          <div className="preview-pane">
            <InvoicePreview
              invoice={computed}
              draft={draft}
              loading={computing}
              error={compErr}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ExcelDropzonePreview({ onDrop }: { onDrop: (r: LineItem[]) => void }) {
  return <ExcelDropzone onRows={(rows) => onDrop(rows)} />
}

export default function SaleInvoicePage() {
  return (
    <DraftProvider>
      <SaleInvoiceInner />
    </DraftProvider>
  )
}