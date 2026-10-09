import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '../icons/Icon'

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
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }
  return (
    <div className="dur-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`dur-sheet wsheet ${className ?? ''}`} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={onKey} data-testid={testid}>
        <header className="dur-hd">
          <h2 id={id}>{title}</h2>
          <button type="button" className="dur-x" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}>
            <Icon name="ui-close" size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  )
}
