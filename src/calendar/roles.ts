// One role per calendar (arc 5a slice 3): Off · Show in optimo · Two-way, mapped onto the stored shape without DDL —
//   off    ⇔ enabled = false and not the write target
//   show   ⇔ enabled = true  and not the write target
//   twoway ⇔ the write target (write_calendar_href = its href; stored enabled = true)
// The server always reads the write target whatever its `enabled`, so a write target reads as Two-way regardless.
import type { CalendarAccount } from '../data/types'

export type Calendar = CalendarAccount['calendars'][number]
export type Role = 'off' | 'show' | 'twoway'
/** What happened to the Two-way calendar: a new one replaced another, the first one, or none is left. */
export type RoleChange = 'moved' | 'first' | 'stopped' | null

export const ROLES: { id: Role; label: string; help: string }[] = [
  { id: 'off', label: 'Off', help: 'Hidden in optimo.' },
  { id: 'show', label: 'Show in optimo', help: 'Its events appear in optimo. optimo never changes it.' },
  { id: 'twoway', label: 'Two-way', help: 'optimo tasks are written here, and edits made here come back.' },
]

export const READ_ONLY_REASON = 'This calendar is read-only on iCloud.'

export const canTwoWay = (cal: Calendar) => cal.writable !== false

export function roleOf(cal: Calendar, writeHref: string | null | undefined): Role {
  if (writeHref && cal.href === writeHref) return 'twoway'
  return cal.enabled ? 'show' : 'off'
}

/**
 * Give `href` the role `role`. Exactly one calendar can be Two-way: picking it demotes the previous one to Show.
 * Two-way on a read-only calendar throws (the UI never offers it). An unknown href or a no-op returns the input as is.
 */
export function applyRole(
  calendars: Calendar[],
  writeHref: string | null | undefined,
  href: string,
  role: Role,
): { calendars: Calendar[]; write_calendar_href: string | null; change: RoleChange } {
  const prevWrite = writeHref ?? null
  const cal = calendars.find((c) => c.href === href)
  if (!cal || roleOf(cal, prevWrite) === role) return { calendars, write_calendar_href: prevWrite, change: null }
  if (role === 'twoway' && !canTwoWay(cal)) throw new Error(`${cal.name}: ${READ_ONLY_REASON}`)

  const enabled = role !== 'off'
  const next = calendars.map((c) => {
    if (c.href === href) return c.enabled === enabled ? c : { ...c, enabled }
    if (role === 'twoway' && c.href === prevWrite && !c.enabled) return { ...c, enabled: true } // demoted → Show
    return c
  })
  let write = prevWrite
  let change: RoleChange = null
  if (role === 'twoway') {
    write = href
    change = prevWrite ? 'moved' : 'first'
  } else if (href === prevWrite) {
    write = null
    change = 'stopped'
  }
  return { calendars: next, write_calendar_href: write, change }
}

/** The toast after a role change that moved, started or stopped two-way writing (#56). */
export function changeMessage(change: RoleChange, name: string): string | null {
  if (change === 'moved') return `optimo tasks now go to “${name}” — the ones already written moved there.`
  if (change === 'first') return `optimo tasks now go to “${name}”.`
  if (change === 'stopped') return 'optimo stopped writing to iCloud. Events already there were left as they are.'
  return null
}
