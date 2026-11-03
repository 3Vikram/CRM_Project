import { useEffect, useRef, useState } from 'react'
import { ListFilter } from 'lucide-react'

export type PageFilterField = {
  key: string
  label: string
  type: 'select' | 'date' | 'text'
  options?: Array<string | { value: string; label: string }>
}

export type PageFilterValues = Record<string, string>

type PageFiltersProps = {
  fields: PageFilterField[]
  values: PageFilterValues
  onApply: (values: PageFilterValues) => void
  onClear: () => void
}

export function PageFilters({ fields, values, onApply, onClear }: PageFiltersProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<PageFilterValues>(values)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setDraft(values)
  }, [values])

  useEffect(() => {
    if (!open) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const updateField = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return (
    <div ref={rootRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7663A8]"
      >
        <ListFilter className="h-4 w-4" />
        Filters
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Page filters"
          className="absolute right-0 top-full z-[70] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <div className="grid max-h-[min(65vh,28rem)] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-600">
                <span>{field.label}</span>
                {field.type === 'select' ? (
                  <select
                    value={draft[field.key] ?? ''}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 outline-none focus:border-[#7663A8] focus:ring-2 focus:ring-[#7663A8]/15"
                  >
                    <option value="">All</option>
                    {(field.options ?? []).map((option) => {
                      const value = typeof option === 'string' ? option : option.value
                      const label = typeof option === 'string' ? option : option.label
                      return <option key={value} value={value}>{label}</option>
                    })}
                  </select>
                ) : (
                  <input
                    type={field.type}
                    value={draft[field.key] ?? ''}
                    onChange={(event) => updateField(field.key, event.target.value)}
                    className="h-9 min-w-0 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 outline-none focus:border-[#7663A8] focus:ring-2 focus:ring-[#7663A8]/15"
                  />
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => {
                setDraft({})
                onClear()
                setOpen(false)
              }}
              className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7663A8]"
            >
              Clear Filters
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft)
                setOpen(false)
              }}
              className="h-9 rounded-lg bg-[#172640] px-3 text-sm font-semibold text-white hover:bg-[#243958] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7663A8]"
            >
              Apply Filters
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
