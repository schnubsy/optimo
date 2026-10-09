import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { Icon } from '../icons/Icon'

/**
 * Escape closes only the child sheet / menu that owns this hook (arc 7 slice 3): a capture-phase window listener runs
 * before the wizard's own Escape (which opens Discard) and stops the key there — even when focus has fallen to <body>
 * (a tap on the sheet's padding), where the sheet's own onKeyDown never sees it.
 */
export function useEscapeClose(onClose: () => void) {
  const latest = useRef(onClose)
  useLayoutEffect(() => {
    latest.current = onClose
  })
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopImmediatePropagation()
      latest.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
}

/**
 * A bottom sheet over the editor (mockups 03 grammar: title + 44 px ×, blurred card). The Duration sheet's look, shared
 * by the alert, repeat, timezone and palette sheets of ③. Esc / scrim / × close; focus moves into it.
 */
export function Sheet({ title, onClose, children, testid, className }: { title: string; onClose: () => void; children: ReactNode; testid?: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const id = `sheet-${testid ?? 'x'}-h`
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, [aria-pressed="true"], button:not(.dur-x)')?.focus()
  }, [])
  useEscapeClose(onClose)
  return (
    <div className="dur-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dur-sheet wsheet ${className ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={id} data-testid={testid}>
        <div className="dur-hd">
          <h2 id={id}>{title}</h2>
          <button type="button" className="dur-x" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
            <Icon name="ui-close" size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
