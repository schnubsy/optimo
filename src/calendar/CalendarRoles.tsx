import { useRef, type KeyboardEvent } from 'react'
import type { CalendarAccount } from '../data/types'
import { useUI } from '../state/ui'
import { setCalendarRole, syncCalendars } from './api'
import { READ_ONLY_REASON, ROLES, applyRole, canTwoWay, changeMessage, roleOf, type Calendar, type Role } from './roles'
import './roles.css'

/**
 * One role per calendar (arc 5a slice 3): Off · Show in optimo · Two-way. Exactly one calendar is Two-way; picking it
 * on another row demotes the old one to Show. Optimistic, stored in one update, then a sync; a change to the Two-way
 * calendar says what happened to the events already written (#56).
 */
export function CalendarRoles({ account: a, onChange }: { account: CalendarAccount; onChange: (next: CalendarAccount) => void }) {
  const notify = useUI((s) => s.notify)
  if (!a.calendars.length) return null

  async function pick(c: Calendar, role: Role) {
    let next: ReturnType<typeof applyRole>
    try {
      next = applyRole(a.calendars, a.write_calendar_href, c.href, role)
    } catch (err) {
      notify({ text: (err as Error).message })
      return
    }
    if (next.calendars === a.calendars && next.write_calendar_href === (a.write_calendar_href ?? null)) return
    onChange({ ...a, calendars: next.calendars, write_calendar_href: next.write_calendar_href })
    try {
      await setCalendarRole(a, next)
    } catch (err) {
      onChange(a) // roll back the optimistic change
      notify({ text: (err as Error).message })
      return
    }
    const msg = changeMessage(next.change, c.name)
    if (msg) notify({ text: msg })
    await syncCalendars().catch(() => undefined)
  }

  const writing = a.calendars.some((c) => roleOf(c, a.write_calendar_href) === 'twoway')
  return (
    <>
      <ul className="cal-list" aria-label={`${a.label} calendars`}>
        {a.calendars.map((c) => (
          <RoleRow key={c.href} cal={c} role={roleOf(c, a.write_calendar_href)} onPick={(r) => void pick(c, r)} />
        ))}
      </ul>
      {!writing && (
        <p className="cal-help" data-testid="calendar-no-twoway">
          optimo isn’t writing to any calendar. Pick Two-way on one to send your tasks there.
        </p>
      )}
    </>
  )
}

function RoleRow({ cal: c, role, onPick }: { cal: Calendar; role: Role; onPick: (r: Role) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const id = `cal-role-${c.href.replace(/[^a-z0-9]+/gi, '-')}`
  const allowed = (r: Role) => r !== 'twoway' || canTwoWay(c)
  const at = ROLES.findIndex((r) => r.id === role)
  const help = ROLES[at].help

  function onKey(e: KeyboardEvent) {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    let n = at
    do n = (n + step + ROLES.length) % ROLES.length
    while (!allowed(ROLES[n].id))
    onPick(ROLES[n].id)
    refs.current[n]?.focus()
  }

  return (
    <li className="cal-role" data-testid="calendar-row" data-role={role}>
      <div className="cal-role-hd">
        <span className="cal-dot" aria-hidden="true" style={c.color ? { background: c.color } : undefined} />
        <span className="cal-name" id={`${id}-name`}>
          {c.name}
        </span>
        {c.shared && (
          <span className="cal-badge" data-testid="calendar-shared">
            Shared
          </span>
        )}
      </div>
      <div className="cal-roles" role="radiogroup" aria-labelledby={`${id}-name`} aria-describedby={`${id}-help`} onKeyDown={onKey} data-testid="calendar-role">
        {ROLES.map((r, i) => {
          const ok = allowed(r.id)
          return (
            <button
              key={r.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={i === at}
              tabIndex={i === at ? 0 : -1}
              disabled={!ok}
              title={ok ? undefined : READ_ONLY_REASON}
              aria-describedby={ok ? undefined : `${id}-ro`}
              onClick={() => onPick(r.id)}
            >
              {r.label}
            </button>
          )
        })}
      </div>
      <p className="cal-help cal-role-help" id={`${id}-help`} data-testid="calendar-role-help">
        {help}
      </p>
      {!canTwoWay(c) && (
        <span className="sr-only" id={`${id}-ro`}>
          {READ_ONLY_REASON}
        </span>
      )}
    </li>
  )
}
