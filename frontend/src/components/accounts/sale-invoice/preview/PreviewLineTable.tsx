'use client'

import type { ComputedInvoice } from '@crm/shared'

export function PreviewLineTable({ invoice }: { invoice: ComputedInvoice }) {
  return <table className="invoice-line-table"><thead><tr>
    <th className="col-sl">Sl<br/>No.</th><th>Description of<br/>Services</th><th className="col-hsn">HSN/SAC</th><th className="col-qty">Quantity</th><th className="col-rate">Rate</th><th className="col-per">per</th><th className="col-amount">Amount</th>
  </tr></thead><tbody>{invoice.lines.map((line, index) => {
    const members = line.subLines?.length ? line.subLines : []
    const first = members[0]
    const serialList = members.map((member) => member.serial).filter(Boolean).join('/')
    const samePeriod = members.length > 0 && members.every((member) => member.from === first?.from && member.to === first?.to)
    const returned = members.some((member) => member.isReturned)
    return <tr key={line.rowRef}>
      <td className="invoice-sl">{index + 1}</td>
      <td className="invoice-description"><strong>Rental-Laptops/Desktops/Servers</strong>
        <div>{first?.model ?? line.description}</div>
        <div>{first?.configuration ?? ''}</div>
        {serialList && <div>S/N:{serialList}</div>}
        {samePeriod && first?.from && first.to && <div>From {fmt(first.from)} to {fmt(first.to)}</div>}
        {!samePeriod && members.map((serial, serialIndex) => <div key={serialIndex}>{serial.from && serial.to && <div>From {fmt(serial.from)} to {fmt(serial.to)}</div>}</div>)}
        {returned && <div>(Returned Billing 2500/- Per Month)</div>}
        {line.isReturned && !members.length && <div>(Returned Billing)</div>}
      </td>
      <td className="invoice-hsn">{line.hsn}</td><td className="invoice-qty">{line.quantity} Pcs</td><td className="invoice-rate">{line.rate.toFixed(2)}</td><td className="invoice-per">Pcs</td><td className="invoice-amount">{line.amount.toFixed(2)}</td>
    </tr>
  })}{!invoice.lines.length && <tr><td colSpan={7} className="invoice-empty">No line items.</td></tr>}</tbody></table>
}
function fmt(iso: string) { const [y,m,d] = iso.split('-'); return y && m && d ? `${d}/${m}/${y}` : iso }
