import { useEffect } from 'react'
import { useUI } from '../state/ui'

/** One toast at a time, 5 s, with Undo and an optional action (directions.md cross-cutting #5). */
export function Toast() {
  const toast = useUI((s) => s.toast)
  const set = useUI((s) => s.set)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => set({ toast: null }), toast.action ? 8000 : 5000)
    return () => clearTimeout(t)
  }, [toast, set])
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      {toast && (
        <div className="toast" key={toast.id} data-testid="toast">
          <span>{toast.text}</span>
          {toast.action && (
            <button type="button" onClick={() => { void toast.action!.run(); set({ toast: null }) }}>
              {toast.action.label}
            </button>
          )}
          {toast.undo && (
            <button type="button" onClick={() => { void toast.undo!(); set({ toast: null }) }}>
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  )
}
