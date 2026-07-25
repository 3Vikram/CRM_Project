'use client'

import { useState } from 'react'
import { useDraft } from '@/pages/accounts/sale-invoice/draft-context'
import { LineItemsTable } from './LineItemsTable'
import type { Entity, TaxType } from '@crm/shared'

interface Props {
  entities: Entity[]
}

/**
 * Left-pane controls for ISSUE-03's spine: per-line amount, HSN, GST-applicable
 * toggle, GST rate, tax-type toggle, invoice date, billing-month From/To.
 * Seller selector + mixed-company warning arrive in ISSUE-05; the buyer block
 * and dispatch section in ISSUE-06/ISSUE-07.
 */
export function ControlsPanel({ entities }: Props) {
  const { draft, dispatch } = useDraft()
  const [grouped, setGrouped] = useState(false)
  const seller = entities.find((e) => e.id === draft.sellerId)

  return (
    <div className="space-y-4">
      <Section title="Invoice">
        <Grid>
          <Field label="Invoice No.">
            <div className="flex gap-1">
              <input
                className="form-input flex-1"
                value={draft.invoiceNo}
                onChange={(e) => dispatch({ type: 'SET', patch: { invoiceNo: e.target.value } })}
                placeholder="3VT/177/2026-27"
              />
              {seller?.invoicePrefix && (
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'SET', patch: { invoiceNo: seller.invoicePrefix ?? '' } })}
                  title="Use seller prefix"
                  className="px-2 h-[var(--input-h,2.5rem)] rounded-md border border-gray-300 bg-gray-50 text-xs text-gray-700 whitespace-nowrap"
                >
                  {seller.invoicePrefix}
                </button>
              )}
            </div>
            <span className="block text-[10px] text-gray-400 mt-1">
              Seller prefix suggested: {seller?.invoicePrefix ?? '—'} · add the running number after it
            </span>
            <input
              className="form-input"
              value={draft.invoiceNo}
              onChange={(e) => dispatch({ type: 'SET', patch: { invoiceNo: e.target.value } })}
              placeholder="3VT/177/2026-27"
            />
          </Field>
          <Field label="Invoice date">
            <input
              type="date"
              className="form-input"
              value={draft.invoiceDate}
              onChange={(e) => dispatch({ type: 'SET', patch: { invoiceDate: e.target.value } })}
            />
          </Field>
          <Field label="Billing month from">
            <input
              type="date"
              className="form-input"
              value={draft.billingMonth.from}
              onChange={(e) =>
                dispatch({
                  type: 'SET',
                  patch: { billingMonth: { ...draft.billingMonth, from: e.target.value } },
                })
              }
            />
          </Field>
          <Field label="Billing month to">
            <input
              type="date"
              className="form-input"
              value={draft.billingMonth.to}
              onChange={(e) =>
                dispatch({
                  type: 'SET',
                  patch: { billingMonth: { ...draft.billingMonth, to: e.target.value } },
                })
              }
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Buyer (Bill to)">
        <Grid>
          <Field label="Name">
            <input className="form-input" value={draft.buyer.name}
              onChange={(e) =>
                dispatch({ type: 'SET_BUYER_WITH_SUGGEST', patch: { name: e.target.value }, entities })
              } placeholder="Flatworld Solutions Pvt.Ltd." />
          </Field>
          <Field label="GSTIN / UIN">
            <input className="form-input uppercase" value={draft.buyer.gstin}
              onChange={(e) => dispatch({ type: 'SET_BUYER', patch: { gstin: e.target.value.toUpperCase() } })} />
          </Field>
          <Field label="Address" className="col-span-2">
            <textarea className="form-input" rows={2} value={draft.buyer.address}
              onChange={(e) => dispatch({ type: 'SET_BUYER', patch: { address: e.target.value } })} />
          </Field>
          <Field label="State">
            <input className="form-input" value={draft.buyer.stateName}
              onChange={(e) => dispatch({ type: 'SET_BUYER_WITH_SUGGEST', patch: { stateName: e.target.value }, entities })} placeholder="Karnataka" />
          </Field>
          <Field label="State code">
            <input className="form-input" value={draft.buyer.stateCode}
              onChange={(e) => dispatch({ type: 'SET_BUYER_WITH_SUGGEST', patch: { stateCode: e.target.value.trim() }, entities })} placeholder="29" />
          </Field>
        </Grid>
        <div className="mt-3 flex items-center gap-4">
          <ToggleField
            label="Shipping same as billing"
            checked={draft.shippingSameAsBilling}
            onChange={(v) => dispatch({ type: 'SET_SHIPPING_SAME', value: v })}
          />
          <div className="text-[11px] text-gray-500">
            Place of Supply: {draft.buyer.stateCode || '—'}
          </div>
        </div>
        {!draft.shippingSameAsBilling && (
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
            <div className="text-xs font-semibold text-gray-500 col-span-2">
              Consignee (Ship to)
            </div>
            <Field label="Name">
              <input className="form-input" value={draft.consignee?.name ?? ''}
                onChange={(e) => dispatch({ type: 'SET_CONSIGNEE', patch: { name: e.target.value } })} />
            </Field>
            <Field label="GSTIN">
              <input className="form-input uppercase" value={draft.consignee?.gstin ?? ''}
                onChange={(e) => dispatch({ type: 'SET_CONSIGNEE', patch: { gstin: e.target.value.toUpperCase() } })} />
            </Field>
            <Field label="Address" className="col-span-2">
              <textarea className="form-input" rows={2} value={draft.consignee?.address ?? ''}
                onChange={(e) => dispatch({ type: 'SET_CONSIGNEE', patch: { address: e.target.value } })} />
            </Field>
            <Field label="State">
              <input className="form-input" value={draft.consignee?.stateName ?? ''}
                onChange={(e) => dispatch({ type: 'SET_CONSIGNEE', patch: { stateName: e.target.value } })} />
            </Field>
            <Field label="State code">
              <input className="form-input" value={draft.consignee?.stateCode ?? ''}
                onChange={(e) => dispatch({ type: 'SET_CONSIGNEE', patch: { stateCode: e.target.value } })} />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Seller">
        <Field label="Seller legal entity">
          <select
            className="form-input"
            value={draft.sellerId}
            onChange={(e) => {
              const ent = entities.find((x) => x.id === e.target.value)
              if (ent) dispatch({ type: 'SET_SELLER', entity: ent })
            }}
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600">
          <div><span className="text-gray-400">GSTIN: </span>{seller?.gstin ?? '—'}</div>
          <div><span className="text-gray-400">Invoice prefix: </span>{seller?.invoicePrefix ?? '—'}</div>
          <div><span className="text-gray-400">State: </span>{seller?.stateName} ({seller?.stateCode})</div>
          <div><span className="text-gray-400">MSME: </span>{seller?.msme ?? '—'}</div>
        </div>
      </Section>

      <Section title="Footer blocks">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <ToggleField label="Remarks" checked={draft.toggles.showRemarks} onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'showRemarks', value: v })} />
          <ToggleField label="Declaration" checked={draft.toggles.showDeclaration} onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'showDeclaration', value: v })} />
          <ToggleField label="Terms & conditions" checked={draft.toggles.showTc} onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'showTc', value: v })} />
          <ToggleField label="Bank details" checked={draft.toggles.showBank} onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'showBank', value: v })} />
        </div>
        <div className="mt-2 text-[11px] text-gray-500">
          When on, empty fields fall back to the seller preset (remarks
          template substitutes the billing month). Override below.
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <Field label="Remarks override">
            <input className="form-input" value={draft.footer.remarks ?? ''}
              onChange={(e) => dispatch({ type: 'SET', patch: { footer: { ...draft.footer, remarks: e.target.value } } })}
              placeholder="Seller template used when blank" />
          </Field>
        </div>
      </Section>

      <CollapsibleSection
        title="Dispatch & reference details"
        open={draft.toggles.dispatchDetails}
        onToggle={(v) => dispatch({ type: 'SET_TOGGLE', key: 'dispatchDetails', value: v })}
      >
        {!draft.toggles.dispatchDetails ? (
          <div className="text-xs text-gray-400">Expand to expose the dispatch + reference section.</div>
        ) : (
          <Grid>
            <Field label="Delivery Note">
              <input className="form-input" value={draft.dispatchDetails?.deliveryNote ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { deliveryNote: e.target.value } })} />
            </Field>
            <Field label="Delivery Note Date">
              <input type="date" className="form-input" value={draft.dispatchDetails?.deliveryNoteDate ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { deliveryNoteDate: e.target.value } })} />
            </Field>
            <Field label="Dispatch Doc No.">
              <input className="form-input" value={draft.dispatchDetails?.dispatchDocNo ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { dispatchDocNo: e.target.value } })} />
            </Field>
            <Field label="Dispatched through">
              <input className="form-input" value={draft.dispatchDetails?.dispatchedThrough ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { dispatchedThrough: e.target.value } })} />
            </Field>
            <Field label="Destination">
              <input className="form-input" value={draft.dispatchDetails?.destination ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { destination: e.target.value } })} />
            </Field>
            <Field label="Reference No.">
              <input className="form-input" value={draft.dispatchDetails?.referenceNo ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { referenceNo: e.target.value } })} />
            </Field>
            <Field label="Reference Date">
              <input type="date" className="form-input" value={draft.dispatchDetails?.referenceDate ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { referenceDate: e.target.value } })} />
            </Field>
            <Field label="Other References">
              <input className="form-input" value={draft.dispatchDetails?.otherReferences ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { otherReferences: e.target.value } })} />
            </Field>
            <Field label="Terms of Delivery" className="col-span-2">
              <input className="form-input" value={draft.dispatchDetails?.termsOfDelivery ?? ''}
                onChange={(e) => dispatch({ type: 'SET_DISPATCH', patch: { termsOfDelivery: e.target.value } })} />
            </Field>
          </Grid>
        )}
      </CollapsibleSection>

      <Section title="Optional blocks">
        <Grid>
          <ToggleField label="Buyer's Order No. + Date" checked={draft.toggles.buyersOrder}
            onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'buyersOrder', value: v })} />
          <ToggleField label="e-Invoice (IRN / Ack No / Ack Date)" checked={draft.toggles.eInvoice}
            onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'eInvoice', value: v })} />
        </Grid>
        {draft.toggles.buyersOrder && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Buyer's Order No.">
              <input className="form-input" value={draft.buyersOrder?.orderNo ?? ''}
                onChange={(e) => dispatch({ type: 'SET_BUYER_ORDER', patch: { orderNo: e.target.value } })} />
            </Field>
            <Field label="Dated">
              <input type="date" className="form-input" value={draft.buyersOrder?.orderDate ?? ''}
                onChange={(e) => dispatch({ type: 'SET_BUYER_ORDER', patch: { orderDate: e.target.value } })} />
            </Field>
          </div>
        )}
        {draft.toggles.eInvoice && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="IRN">
              <input className="form-input" value={draft.eInvoice?.irn ?? ''}
                onChange={(e) => dispatch({ type: 'SET_EINVOICE', patch: { irn: e.target.value } })} />
            </Field>
            <Field label="Ack No.">
              <input className="form-input" value={draft.eInvoice?.ackNo ?? ''}
                onChange={(e) => dispatch({ type: 'SET_EINVOICE', patch: { ackNo: e.target.value } })} />
            </Field>
            <Field label="Ack Date">
              <input type="date" className="form-input" value={draft.eInvoice?.ackDate ?? ''}
                onChange={(e) => dispatch({ type: 'SET_EINVOICE', patch: { ackDate: e.target.value } })} />
            </Field>
            <div className="text-[11px] text-gray-500 self-end pb-2">
              e-Invoice metadata is manually entered in v1; live IRN generation is v2.
            </div>
          </div>
        )}
      </Section>

      <Section title="Tax">
        <Grid>
          <ToggleField
            label="GST applicable"
            checked={draft.gstApplicable}
            onChange={(v) => dispatch({ type: 'SET', patch: { gstApplicable: v } })}
          />
          <Field label="GST rate %">
            <input
              type="number"
              step="0.5"
              className="form-input"
              value={draft.gstRate}
              onChange={(e) =>
                dispatch({ type: 'SET', patch: { gstRate: Number(e.target.value) || 0 } })
              }
            />
          </Field>
          <Field label="Tax type">
            <select
              className="form-input"
              value={draft.taxType}
              onChange={(e) =>
                dispatch({ type: 'SET', patch: { taxType: e.target.value as TaxType } })
              }
            >
              <option value="CGST_SGST">CGST + SGST (intra-state)</option>
              <option value="IGST">IGST (inter-state)</option>
              <option value="NONE">None</option>
            </select>
          </Field>
          <ToggleField
            label="Round-off"
            checked={draft.roundOff}
            onChange={(v) => dispatch({ type: 'SET', patch: { roundOff: v } })}
          />
          <Field label="HSN/SAC">
            <input
              className="form-input"
              value={draft.hsn}
              onChange={(e) => dispatch({ type: 'SET', patch: { hsn: e.target.value } })}
            />
          </Field>
          <Field label="Returned billing rate ₹/mo">
            <input
              type="number"
              step="100"
              className="form-input"
              value={draft.returnedBillingRate}
              onChange={(e) =>
                dispatch({ type: 'SET', patch: { returnedBillingRate: Number(e.target.value) || 0 } })
              }
            />
          </Field>
        </Grid>
      </Section>

      <Section title="Line items">
        <div className="mb-3 flex items-center gap-4">
          <ToggleField
            label="Per-line discount"
            checked={draft.toggles.lineDiscount}
            onChange={(v) => dispatch({ type: 'SET_TOGGLE', key: 'lineDiscount', value: v })}
          />
        </div>
        <LineItemsTable
          rows={draft.lines}
          onChange={(lines) => dispatch({ type: 'SET_LINES', lines })}
          returnedBillingRate={draft.returnedBillingRate}
          billingMonthFrom={draft.billingMonth.from}
          showDiscount={draft.toggles.lineDiscount}
          grouped={grouped}
          onToggleGrouped={setGrouped}
        />
      </Section>
    </div>
  )
}

/* ---------- tiny primitives ---------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[#E7E3DA] bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        {title}
      </h3>
      {children}
    </section>
  )
}

function CollapsibleSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#E7E3DA] bg-white">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500"
      >
        <span>{title}</span>
        <span className="text-gray-400">{open ? 'Collapse' : 'Expand'}</span>
      </button>
      {open && <div className="p-4 pt-0">{children}</div>}
    </section>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 self-end pb-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-gray-900"
      />
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </label>
  )
}