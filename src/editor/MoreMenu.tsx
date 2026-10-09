import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Icon } from '../icons/Icon'

export interface MoreItem {
  id: string
  label: string
  icon: string
  run: () => void
  chevron?: boolean
}

/**
 * The ••• popover (mockups 05): grouped rows, glyph in the accent, hairlines between groups. A menu: focus lands on
 * the first item, ↑/↓ move, Esc / a tap outside closes and focus returns to the trigger.
 */
export function MoreMenu({ label, groups, onClose, testid }: { label: string; groups: MoreItem[][]; onClose: () => void; testid?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [])
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    } else if (e.key === 'Tab') onClose()
  }
  return (
    <>
      <div className="more-scrim" onMouseDown={onClose} aria-hidden="true" />
      <div ref={ref} className="more-menu" role="menu" aria-label={label} onKeyDown={onKey} data-testid={testid}>
        {groups.map((g, gi) => (
          <div key={gi} className="more-group" role="group">
            {g.map((it) => (
              <button
                key={it.id}
                type="button"
                role="menuitem"
                className="more-item"
                onClick={() => {
                  onClose()
                  it.run()
                }}
                data-testid={`more-${it.id}`}
              >
                <Icon name={it.icon} size={22} />
                <span>{it.label}</span>
                {it.chevron && <Icon name="ui-chevron-right" size={16} className="more-chev" />}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
