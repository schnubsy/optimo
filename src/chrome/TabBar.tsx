import { useRef, type KeyboardEvent } from 'react'
import { Icon } from '../icons/Icon'
import { useInboxCount } from '../data/hooks'
import './tabbar.css'

/** arc 6: four tabs — Week left the bar (desktop segmented control + the collapsed panel reach it). */
export type TabId = 'inbox' | 'timeline' | 'plan' | 'settings'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'ui-inbox' },
  { id: 'timeline', label: 'Timeline', icon: 'ui-timeline' },
  { id: 'plan', label: 'AI', icon: 'ui-ai' },
  { id: 'settings', label: 'Settings', icon: 'ui-settings' },
]

interface Props {
  active: TabId
  onChange: (t: TabId) => void
  /** fired when the already-active tab is tapped (slice 4: Timeline toggles the panel detent) */
  onReselect?: (t: TabId) => void
  /** slice 4 passes 'ui-grid-2x3' while the day panel is collapsed to the week overview */
  timelineGlyph?: string
  recede: boolean
}

/** The floating pill tab bar (iPhone, mockup 01): --node at 80 % + blur, opaque under reduced transparency / more contrast. */
export function TabBar({ active, onChange, onReselect, timelineGlyph = 'ui-timeline', recede }: Props) {
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  // arc 7 slice 6: the Inbox tab counts what is waiting to be sorted (unfinished inbox items; hidden at 0)
  const inboxN = useInboxCount() ?? 0
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = TABS.findIndex((t) => t.id === active)
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <nav className={`tabbar ${recede ? 'recede' : ''}`} aria-label="Sections" data-testid="tabbar">
      <div role="tablist" aria-label="Sections" onKeyDown={onKey}>
        {TABS.map((t) => {
          const on = t.id === active
          const n = t.id === 'inbox' ? inboxN : 0
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el
              }}
              type="button"
              role="tab"
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              onClick={() => (on ? onReselect?.(t.id) : onChange(t.id))}
              data-testid={t.id === 'inbox' ? 'tab-backlog' : `tab-${t.id}`}
              aria-label={n ? `${t.label}, ${n} ${n === 1 ? 'item' : 'items'}` : undefined}
            >
              <span className="tab-pill" aria-hidden="true" data-testid={on ? 'tab-active-pill' : undefined} />
              <Icon name={t.id === 'timeline' ? timelineGlyph : t.icon} size={24} />
              <span className="tab-l">{t.label}</span>
              {n > 0 && (
                <span className="tab-badge tnum" aria-hidden="true" data-testid="tab-badge">
                  {n > 99 ? '99+' : n}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
