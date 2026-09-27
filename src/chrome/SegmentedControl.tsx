import { useRef, type KeyboardEvent } from 'react'

/** Floating segmented pill (desktop Day · Week · Month): roving tabindex, ← → cycle (design spec §5.8). */
export function SegmentedControl<T extends string>({ items, value, onChange, label }: { items: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const at = Math.max(0, items.findIndex((i) => i.id === value))
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const n = (at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    onChange(items[n].id)
    refs.current[n]?.focus()
  }
  return (
    <div className="segmented" role="tablist" aria-label={label} onKeyDown={onKey} data-testid="segmented">
      {items.map((it, i) => (
        <button
          key={it.id}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="button"
          role="tab"
          aria-selected={i === at}
          tabIndex={i === at ? 0 : -1}
          onClick={() => onChange(it.id)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
