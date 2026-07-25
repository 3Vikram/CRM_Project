'use client'

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

  return (
    <div className="space-y-4">
      <Section title="Invoice">
        <Grid>
          <Field label="Invoice No.">
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
        <LineItemsTable
          rows={draft.lines}
          onChange={(lines) => dispatch({ type: 'SET_LINES', lines })}
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
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
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