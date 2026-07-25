'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import type { Entity, InvoiceDraft, LineItem, TaxType } from '@crm/shared'
import { suggestTaxTypeFor } from '@/lib/tax-suggest'
import { todayISO, previousFullMonth } from '@/lib/dates'

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
}

const DraftContext = createContext<DraftContextValue | null>(null)

const STORAGE_KEY = 'crm.sale-invoice.draft.v1'

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, dispatch] = useReducer(reducer, undefined, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as InvoiceDraft
    } catch {
      /* ignore */
    }
    return emptyDraft()
  })

  // ISSUE-09 will own debounced autosave; a light save here keeps the draft
  // alive across hot reloads during development.
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
      } catch {
        /* ignore quota errors */
      }
    }, 600)
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [draft])

  const value = useMemo(() => ({ draft, dispatch }), [draft])
  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>
}

export function useDraft() {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used inside <DraftProvider>')
  return ctx
}

export function clearStoredDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export type { TaxType }