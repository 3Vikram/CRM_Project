'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Entity, InvoiceDraft, LineItem, TaxType } from '@crm/shared'
import { suggestTaxTypeFor } from '@/lib/tax-suggest'
import { todayISO, previousFullMonth } from '@/lib/dates'
import { useInvoiceDraft, useSaveInvoiceDraft, useClearInvoiceDraft } from '@/lib/queries/sales-invoices'

/**
 * Default draft shape — empty ledger, ready for an operator to drop rows.
 * Defaults reflect the PRD: HSN 997315, GST 18%, CGST_SGST suggested (Karnataka
 * seller to a Karnataka buyer), round-off on, returnedBillingRate 2500,
 * invoice date today, billing month = previous full calendar month.
 */
export function emptyDraft(seller?: Entity): InvoiceDraft {
  const toggles: InvoiceDraft['toggles'] = {
    eInvoice: seller?.eInvoiceDefault ?? false,
    buyersOrder: false,
    dispatchDetails: false,
    lineDiscount: false,
    showRemarks: true,
    showDeclaration: true,
    showTc: true,
    showBank: true,
  }
  return {
    sellerId: seller?.id ?? '3vikram',
    buyer: { name: '', address: '', gstin: '', stateName: '', stateCode: '' },
    shippingSameAsBilling: true,
    consignee: undefined,
    hsn: '997315',
    gstApplicable: true,
    gstRate: 18,
    taxType: 'CGST_SGST',
    roundOff: true,
    returnedBillingRate: 2500,
    invoiceNo: '',
    invoiceDate: todayISO(),
    billingMonth: previousFullMonth(),
    lines: [],
    toggles,
    footer: {},
  }
}

export type DraftAction =
  | { type: 'SET_LINES'; lines: LineItem[] }
  | { type: 'SET'; patch: Partial<InvoiceDraft> }
  | { type: 'SET_SELLER'; entity: Entity; invoiceNo?: string }
  | { type: 'SET_BUYER'; patch: Partial<InvoiceDraft['buyer']> }
  | { type: 'SET_BUYER_WITH_SUGGEST'; patch: Partial<InvoiceDraft['buyer']>; entities: Entity[] }
  | { type: 'SET_CONSIGNEE'; patch: Partial<NonNullable<InvoiceDraft['consignee']>> }
  | { type: 'SET_SHIPPING_SAME'; value: boolean }
  | { type: 'SET_TOGGLE'; key: keyof InvoiceDraft['toggles']; value: boolean }
  | { type: 'SET_FOOTER'; patch: Partial<InvoiceDraft['footer']> }
  | { type: 'SET_DISPATCH'; patch: Partial<NonNullable<InvoiceDraft['dispatchDetails']>> }
  | { type: 'SET_BUYER_ORDER'; patch: Partial<NonNullable<InvoiceDraft['buyersOrder']>> }
  | { type: 'SET_EINVOICE'; patch: Partial<NonNullable<InvoiceDraft['eInvoice']>> }
  | { type: 'UPDATE_LINE'; index: number; patch: Partial<LineItem> }
  | { type: 'REMOVE_LINE'; index: number }
  | { type: 'SET_LINES_AND_SELLER'; lines: LineItem[]; entity: Entity }
  | { type: 'RESET'; seller?: Entity }

function reducer(state: InvoiceDraft, action: DraftAction): InvoiceDraft {
  switch (action.type) {
    case 'SET_LINES':
      return { ...state, lines: action.lines }
    case 'SET':
      return { ...state, ...action.patch }
    case 'SET_SELLER':
      return {
        ...state,
        sellerId: action.entity.id,
        toggles: {
          ...state.toggles,
          eInvoice: action.entity.eInvoiceDefault,
        },
        invoiceNo:
          action.invoiceNo ??
          (state.invoiceNo.trim()
            ? state.invoiceNo
            : (action.entity.invoicePrefix ?? '')),
        footer: {
          ...state.footer,
          remarks: state.footer.remarks ?? '',
          declaration: action.entity.declaration,
          terms: action.entity.terms,
          bank: action.entity.bank,
        },
      }
    case 'SET_BUYER':
      return { ...state, buyer: { ...state.buyer, ...action.patch } }
    case 'SET_BUYER_WITH_SUGGEST': {
      const buyer = { ...state.buyer, ...action.patch }
      const seller = action.entities.find((e) => e.id === state.sellerId)
      const suggested = suggestTaxTypeFor(seller, buyer, state.gstApplicable)
      return { ...state, buyer, taxType: suggested }
    }
    case 'SET_CONSIGNEE':
      return {
        ...state,
        consignee: {
          name: '', address: '', gstin: '', stateName: '', stateCode: '',
          ...(state.consignee ?? {}),
          ...action.patch,
        },
      }
    case 'SET_SHIPPING_SAME':
      return {
        ...state,
        shippingSameAsBilling: action.value,
        consignee: action.value ? undefined : state.consignee,
      }
    case 'SET_TOGGLE':
      return {
        ...state,
        toggles: { ...state.toggles, [action.key]: action.value },
      }
    case 'SET_FOOTER':
      return { ...state, footer: { ...state.footer, ...action.patch } }
    case 'SET_DISPATCH':
      return {
        ...state,
        dispatchDetails: {
          ...(state.dispatchDetails ?? {
            deliveryNote: '', deliveryNoteDate: '', dispatchDocNo: '',
            dispatchedThrough: '', destination: '', referenceNo: '',
            referenceDate: '', otherReferences: '', termsOfDelivery: '',
          }),
          ...action.patch,
        },
      }
    case 'SET_BUYER_ORDER':
      return {
        ...state,
        buyersOrder: {
          ...(state.buyersOrder ?? { orderNo: '', orderDate: '' }),
          ...action.patch,
        },
      }
    case 'SET_EINVOICE':
      return {
        ...state,
        eInvoice: {
          ...(state.eInvoice ?? { irn: '', ackNo: '', ackDate: '' }),
          ...action.patch,
        },
      }
    case 'UPDATE_LINE':
      return {
        ...state,
        lines: state.lines.map((l, i) =>
          i === action.index ? { ...l, ...action.patch } : l,
        ),
      }
    case 'REMOVE_LINE':
      return { ...state, lines: state.lines.filter((_, i) => i !== action.index) }
    case 'SET_LINES_AND_SELLER':
      return {
        ...state,
        lines: action.lines,
        sellerId: action.entity.id,
        toggles: { ...state.toggles, eInvoice: action.entity.eInvoiceDefault },
        invoiceNo: state.invoiceNo.trim()
          ? state.invoiceNo
          : (action.entity.invoicePrefix ?? ''),
        footer: {
          ...state.footer,
          declaration: action.entity.declaration,
          terms: action.entity.terms,
          bank: action.entity.bank,
        },
      }
    case 'RESET':
      return emptyDraft(action.seller)
    default:
      return state
  }
}

interface DraftContextValue {
  draft: InvoiceDraft
  dispatch: React.Dispatch<DraftAction>
  /** True once the server draft has been fetched and reconciled — autosave waits for this. */
  hydrated: boolean
}

const DraftContext = createContext<DraftContextValue | null>(null)

// Legacy localStorage key, kept only for the one-time upload of a draft that
// was saved before this page started autosaving to the server.
const LEGACY_STORAGE_KEY = 'crm.sale-invoice.draft.v1'

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(reducer, undefined, () => {
    // Synchronous fallback so the first paint isn't empty while the server
    // draft loads; reconciled (and overwritten if the server has one) below.
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (raw) return JSON.parse(raw) as InvoiceDraft
    } catch {
      /* ignore */
    }
    return emptyDraft()
  })
  const [hydrated, setHydrated] = useState(false)
  const { data: serverDraft, isSuccess } = useInvoiceDraft()
  const saveDraft = useSaveInvoiceDraft()

  // Reconcile with the server once: prefer the server's draft; if it has
  // none but a legacy local one exists, upload that once and clear it.
  useEffect(() => {
    if (!isSuccess || hydrated) return
    if (serverDraft?.draft) {
      dispatch({ type: 'SET', patch: serverDraft.draft })
    } else {
      try {
        const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (raw) saveDraft.mutate(JSON.parse(raw) as InvoiceDraft)
      } catch {
        /* ignore */
      }
    }
    try { localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { /* ignore */ }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, serverDraft, hydrated])

  // Debounced autosave to the server, only once hydrated (so we never
  // overwrite a real server draft with the pre-hydration placeholder state).
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (!hydrated) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraft.mutate(draft), 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, hydrated])

  const value = useMemo(() => ({ draft, dispatch, hydrated }), [draft, hydrated])
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used inside <DraftProvider>')
  return ctx
}

/** Clears the server-side draft (and any leftover legacy localStorage copy) after a successful issue/reset. */
export function useClearDraft() {
  const clear = useClearInvoiceDraft()
  return () => {
    clear.mutate()
    try { localStorage.removeItem(LEGACY_STORAGE_KEY) } catch { /* ignore */ }
  }
}

export type { TaxType }
