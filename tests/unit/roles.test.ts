// arc 5a slice 3 — one role per calendar (Off · Show in optimo · Two-way) mapped onto enabled + write_calendar_href.
import { describe, expect, it } from 'vitest'
import { applyRole, changeMessage, roleOf, type Calendar } from '../../src/calendar/roles'

const cal = (name: string, enabled = true, writable = true): Calendar => ({ href: `/c/${name}/`, name, color: null, enabled, writable })
const A = cal('A')
const B = cal('B')
const C = cal('C', false)
const RO = cal('Family', true, false)
const all = [A, B, C, RO]
const roles = (cals: Calendar[], write: string | null) => cals.map((c) => `${c.name}:${roleOf(c, write)}`).join(' ')

describe('roleOf — stored shape → role', () => {
  it('maps enabled + write target', () => {
    expect(roles(all, A.href)).toBe('A:twoway B:show C:off Family:show')
    expect(roles(all, null)).toBe('A:show B:show C:off Family:show')
  })
  it('the write target is Two-way even if its stored enabled is false (the server still reads and writes it)', () => {
    expect(roleOf(C, C.href)).toBe('twoway')
  })
})

describe('applyRole — role → stored shape', () => {
  it('Off ⇔ enabled=false; Show ⇔ enabled=true; neither touches the write target of another row', () => {
    const off = applyRole(all, A.href, B.href, 'off')
    expect(off.calendars.find((c) => c.href === B.href)!.enabled).toBe(false)
    expect(off.write_calendar_href).toBe(A.href)
    expect(off.change).toBeNull()
    const show = applyRole(all, A.href, C.href, 'show')
    expect(show.calendars.find((c) => c.href === C.href)!.enabled).toBe(true)
    expect(show.write_calendar_href).toBe(A.href)
    expect(show.change).toBeNull()
  })

  it('first Two-way: sets the write target and enables the calendar', () => {
    const r = applyRole(all, null, C.href, 'twoway')
    expect(r.write_calendar_href).toBe(C.href)
    expect(r.calendars.find((c) => c.href === C.href)!.enabled).toBe(true)
    expect(r.change).toBe('first')
    expect(roles(r.calendars, r.write_calendar_href)).toBe('A:show B:show C:twoway Family:show')
  })

  it('single Two-way: picking B while A is Two-way demotes A to Show', () => {
    const r = applyRole(all, A.href, B.href, 'twoway')
    expect(r.write_calendar_href).toBe(B.href)
    expect(r.change).toBe('moved')
    expect(roles(r.calendars, r.write_calendar_href)).toBe('A:show B:twoway C:off Family:show')
  })

  it('demoting a write target stored with enabled=false turns it on (Show), never silently Off', () => {
    const r = applyRole(all, C.href, B.href, 'twoway')
    expect(r.calendars.find((c) => c.href === C.href)!.enabled).toBe(true)
    expect(roleOf(r.calendars.find((c) => c.href === C.href)!, r.write_calendar_href)).toBe('show')
  })

  it('Off on the Two-way row clears the write target and disables it; Show on it keeps it enabled', () => {
    const off = applyRole(all, A.href, A.href, 'off')
    expect(off.write_calendar_href).toBeNull()
    expect(off.calendars.find((c) => c.href === A.href)!.enabled).toBe(false)
    expect(off.change).toBe('stopped')
    const show = applyRole(all, A.href, A.href, 'show')
    expect(show.write_calendar_href).toBeNull()
    expect(show.calendars.find((c) => c.href === A.href)!.enabled).toBe(true)
    expect(show.change).toBe('stopped')
  })

  it('read-only calendars cannot be Two-way', () => {
    expect(() => applyRole(all, A.href, RO.href, 'twoway')).toThrow(/read-only on iCloud/)
    expect(applyRole(all, A.href, RO.href, 'off').calendars.find((c) => c.href === RO.href)!.enabled).toBe(false)
  })

  it('idempotent: the current role (or an unknown href) changes nothing', () => {
    for (const [href, role] of [
      [A.href, 'twoway'],
      [B.href, 'show'],
      [C.href, 'off'],
      ['/nope/', 'twoway'],
    ] as const) {
      const r = applyRole(all, A.href, href, role)
      expect(r.calendars).toBe(all)
      expect(r.write_calendar_href).toBe(A.href)
      expect(r.change).toBeNull()
    }
    const once = applyRole(all, A.href, B.href, 'twoway')
    const twice = applyRole(once.calendars, once.write_calendar_href, B.href, 'twoway')
    expect(twice.calendars).toBe(once.calendars)
    expect(twice.change).toBeNull()
  })

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(all)
    applyRole(all, A.href, B.href, 'twoway')
    applyRole(all, A.href, A.href, 'off')
    expect(JSON.stringify(all)).toBe(snapshot)
  })
})

describe('changeMessage (#56)', () => {
  it('says what happened to already-written events', () => {
    expect(changeMessage('moved', 'Home')).toBe('optimo tasks now go to “Home” — the ones already written moved there.')
    expect(changeMessage('first', 'Home')).toBe('optimo tasks now go to “Home”.')
    expect(changeMessage('stopped', 'Home')).toBe('optimo stopped writing to iCloud. Events already there were left as they are.')
    expect(changeMessage(null, 'Home')).toBeNull()
  })
})
