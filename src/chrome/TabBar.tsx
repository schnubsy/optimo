import { useRef, type KeyboardEvent } from 'react'
import { Icon } from '../icons/Icon'

export type TabId = 'inbox' | 'timeline' | 'week' | 'plan' | 'settings'

// The AI arc inserts "Plan" between Week and Settings (design spec §5.6). Until then its column is reserved and
// hidden: flip this (or settings.aiTab, once it exists) and nothing else in the bar changes.
export const RESERVED_AI_TAB = false

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: 'ui-inbox' },
  { id: 'timeline', label: 'Timeline', icon: 'ui-timeline' },
  { id: 'week', label: 'Week', icon: 'ui-week' },
  { id: 'plan', label: 'Plan', icon: 'ui-plan' },
  { id: 'settings', label: 'Settings', icon: 'ui-settings' },
]

/** The floating pill tab bar (iPhone): blur over 80% canvas, opaque under reduced transparency / more contrast. */
export function TabBar({ active, onChange, inboxCount, recede }: { active: TabId; onChange: (t: TabId) => void; inboxCount: number; recede: boolean }) {
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const shown = TABS.filter((t) => t.id !== 'plan' || RESERVED_AI_TAB)
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = shown.findIndex((t) => t.id === active)
    const next = shown[(i + (e.key === 'ArrowRight' ? 1 : -1) + shown.length) % shown.length]
    onChange(next.id)
    refs.current[next.id]?.focus()
  }
  return (
    <nav className={`tabbar ${recede ? 'recede' : ''}`} aria-label="Sections" data-testid="tabbar">
      <div role="tablist" aria-label="Sections" onKeyDown={onKey}>
        {TABS.map((t) => {
          const on = t.id === active
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
              hidden={t.id === 'plan' && !RESERVED_AI_TAB}
              onClick={() => onChange(t.id)}
              data-testid={t.id === 'inbox' ? 'tab-backlog' : `tab-${t.id}`}
            >
              <span className="tab-ic">
                <Icon name={t.icon} size={22} filled={on} />
                {t.id === 'inbox' && inboxCount > 0 && <b className="tab-badge tnum">{inboxCount}</b>}
              </span>
              <span className="tab-l">{t.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
