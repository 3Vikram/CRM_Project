// Pure, storage-free helpers shared by the Accounts pages. Everything that
// used to read/write localStorage or compute ledgers/reports client-side now
// lives on the server (see backend/src/accounting and
// frontend/src/lib/queries/accounting.ts) — this file only keeps the bits
// that have nothing to do with where the data comes from.

export const today = () => new Date().toISOString().slice(0, 10)

export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0)

export function exportCsv(name: string, headers: string[], rows: (string | number)[][]) {
  const q = (v: string | number) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const blob = new Blob([[headers, ...rows].map((r) => r.map(q).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}
