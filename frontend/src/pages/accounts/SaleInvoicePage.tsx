'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, FileCheck2, RotateCcw } from 'lucide-react'
import type { Entity, LineItem } from '@crm/shared'
import { fetchEntities, computeInvoice, ComputationError } from '@/lib/api'
import { useDebounced } from '@/lib/useDebounced'
import { ExcelDropzone } from '@/components/accounts/sale-invoice/ExcelDropzone'
import { ControlsPanel } from '@/components/accounts/sale-invoice/ControlsPanel'
import { InvoicePreview } from '@/components/accounts/sale-invoice/preview/InvoicePreview'
import { groupIdentical } from '@/lib/groupLines'
import { useIssueSalesInvoice, useSalesInvoices, useCancelSalesInvoice } from '@/lib/queries/sales-invoices'
import {
  DraftProvider,
  useDraft,
  useClearDraft,
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
    // The invoice itself is configuration-based: one configuration line with
    // all of its device serial numbers beneath it.
    dispatch({ type: 'SET_LINES_AND_SELLER', lines: groupIdentical(rows), entity: seller })
  }

  const clearDraft = useClearDraft()
  const issueInvoice = useIssueSalesInvoice()
  const cancelInvoice = useCancelSalesInvoice()
  const { data: history } = useSalesInvoices(draft.sellerId)
  const [issueError, setIssueError] = useState<string | null>(null)

  const handleReset = () => {
    clearDraft()
    dispatch({ type: 'RESET', seller: entities[0] })
    setComputed(null)
    setCompErr(null)
  }

  const handleIssue = async () => {
    setIssueError(null)
    try {
      await issueInvoice.mutateAsync(draft)
      window.print()
      clearDraft()
      dispatch({ type: 'RESET', seller: entities[0] })
      setComputed(null)
    } catch (err) {
      setIssueError(err instanceof Error ? err.message : 'Could not issue the invoice')
    }
  }

  const mixedCompany = useMemo(() => {
    const companies = new Set(draft.lines.map((l) => l.company).filter(Boolean))
    return companies.size > 1
  }, [draft.lines])

  const splitByCompany = (company: string) => {
    const entityId = company === 'SYNOV' ? 'synov' : company === '3VIKRAM' ? '3vikram' : draft.sellerId
    const seller = entities.find((entity) => entity.id === entityId)
    const lines = draft.lines.filter((line) => (line.company ?? '').toUpperCase() === company)
    if (seller) dispatch({ type: 'SET_LINES_AND_SELLER', lines, entity: seller })
    else dispatch({ type: 'SET_LINES', lines })
  }

  return (
    <div className="space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between" data-no-print>
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
          <span className="hidden sm:inline-flex items-center px-2.5 h-8 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs">
            Autosaves to your account
          </span>
          <button
            type="button"
            disabled={!computed || Boolean(computed?.mixedCompany) || issueInvoice.isPending}
            title={computed?.mixedCompany ? 'Split SYNOV and 3VIKRAM rows into separate invoices before issuing.' : undefined}
            onClick={handleIssue}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800"
          >
            <FileCheck2 className="w-4 h-4" />
            {issueInvoice.isPending ? 'Issuing…' : 'Issue & Print'}
          </button>
          <button
            type="button"
            disabled={!computed || Boolean(computed?.mixedCompany)}
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <Download className="w-4 h-4" />
            Print preview
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

      {issueError && (
        <div data-no-print className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          Could not issue the invoice: {issueError}
        </div>
      )}
      {loadErr && (
        <div data-no-print className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          Could not load seller presets from /api/entities: {loadErr}. Is the
          backend running on port 4000?
        </div>
      )}
      {mixedCompany && (
        <div data-no-print className="rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
          <div className="font-semibold">
            The dropped rows contain mixed <code>COMPANY</code> values — split
            into two invoices before generating.
          </div>
          {computed?.mixedCompany && computed?.companyBreakdown && (
            <div className="mt-1 text-xs">
              {computed.companyBreakdown.map((c) => `${c.company}: ${c.count}`).join(' · ')}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            {['SYNOV', '3VIKRAM'].filter((company) => draft.lines.some((line) => line.company === company)).map((company) => (
              <button key={company} type="button" onClick={() => splitByCompany(company)} className="rounded border border-amber-400 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100">
                Create {company} invoice
              </button>
            ))}
          </div>
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

      {!!history?.length && (
        <div data-no-print className="rounded-lg border border-[#EFECE5] bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-gray-900">Issued invoices for this seller</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr><th className="px-2 py-1.5">Invoice</th><th className="px-2 py-1.5">Date</th><th className="px-2 py-1.5">Buyer</th><th className="px-2 py-1.5">Total</th><th className="px-2 py-1.5">Status</th><th className="px-2 py-1.5" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-2 py-1.5">{inv.invoiceNumber}</td>
                    <td className="px-2 py-1.5">{inv.invoiceDate}</td>
                    <td className="px-2 py-1.5">{inv.buyerName}</td>
                    <td className="px-2 py-1.5">₹{Number(inv.grandTotal).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${inv.status === 'issued' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{inv.status}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      {inv.status === 'issued' && (
                        <button className="text-xs text-red-700 hover:underline" onClick={() => cancelInvoice.mutate({ id: inv.id, reason: 'Cancelled from Sale Invoice history' })}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
