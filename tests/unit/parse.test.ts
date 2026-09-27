import { describe, expect, it } from 'vitest'
import { parseQuickAdd } from '../../src/quickadd/parse'

// Reference: Sat 26 Sep 2026, 10:00 local
const REF = new Date(2026, 8, 26, 10, 0)
const p = (s: string) => parseQuickAdd(s, REF)
const hm = (d: Date | null) => (d ? `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : null)

describe('parseQuickAdd', () => {
  it('"Lunch with Sam at 1pm" → title + today 13:00, default duration', () => {
    const r = p('Lunch with Sam at 1pm')
    expect(r.title).toBe('Lunch with Sam')
    expect(hm(r.start)).toBe('9/26 13:00')
    expect(r.duration).toBeNull()
    expect(r.dateOnly).toBe(false)
  })

  it('"Gym every weekday for 1h #health !!"', () => {
    const r = p('Gym every weekday for 1h #health !!')
    expect(r).toMatchObject({ title: 'Gym', duration: 60, category: 'health', priority: 2, rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', repeatLabel: 'every weekday' })
    expect(r.dateOnly).toBe(true)
  })

  it('plain text is all title and goes to the inbox', () => {
    expect(p('buy milk')).toMatchObject({ title: 'Buy milk', start: null, duration: null, priority: 0, rrule: null })
  })

  it('a bare time that already passed is still today', () => {
    expect(hm(p('standup 9:30').start)).toBe('9/26 09:30')
  })

  it('time ranges set duration', () => {
    const r = p('standup 9:30-10')
    expect(hm(r.start)).toBe('9/26 09:30')
    expect(r.duration).toBe(30)
    expect(r.title).toBe('Standup')
  })

  it('"meeting 1pm to 2:30pm" → 90 min', () => {
    expect(p('meeting 1pm to 2:30pm').duration).toBe(90)
  })

  it('tomorrow without a time is a date-only (all-day) task', () => {
    const r = p('call mum tomorrow')
    expect(r.title).toBe('Call mum')
    expect(r.dateOnly).toBe(true)
    expect(hm(r.start)).toBe('9/27 00:00')
  })

  it('weekday + time', () => {
    const r = p('dentist next friday 3pm')
    expect(r.title).toBe('Dentist')
    expect(hm(r.start)).toBe('10/2 15:00')
  })

  it('"on Monday at 14:00" strips the connective', () => {
    const r = p('review on Monday at 14:00')
    expect(r.title).toBe('Review')
    expect(hm(r.start)).toBe('9/28 14:00')
  })

  it('noon', () => {
    expect(hm(p('plan at noon').start)).toBe('9/26 12:00')
    expect(p('plan at noon').title).toBe('Plan')
  })

  it.each([
    ['write for 45m', 45],
    ['write for 45 min', 45],
    ['write for 90 minutes', 90],
    ['write for 1h30', 90],
    ['write for 1.5h', 90],
    ['write for 2 hours', 120],
    ['write for an hour', 60],
    ['write for half an hour', 30],
  ])('duration: %s → %i', (s, d) => {
    const r = p(s)
    expect(r.duration).toBe(d)
    expect(r.title).toBe('Write')
  })

  it.each([
    ['ship it !', 1],
    ['ship it !!', 2],
    ['ship it !!!', 3],
  ])('priority: %s → %i', (s, n) => {
    expect(p(s)).toMatchObject({ title: 'Ship it', priority: n })
  })

  it('an exclamation inside a word is not priority', () => {
    expect(p('wow! great').priority).toBe(0)
  })

  it('#category and @icon are lifted out of the title', () => {
    expect(p('run 5k #health @run')).toMatchObject({ title: 'Run 5k', category: 'health', icon: 'run' })
  })

  it('every Monday anchors on the next Monday', () => {
    const r = p('team sync every monday at 10am')
    expect(r.rrule).toBe('FREQ=WEEKLY;BYDAY=MO')
    expect(hm(r.start)).toBe('9/28 10:00')
    expect(r.title).toBe('Team sync')
  })

  it('every day at a time starts today', () => {
    const r = p('stretch every day at 7am for 15m')
    expect(r).toMatchObject({ title: 'Stretch', rrule: 'FREQ=DAILY', duration: 15 })
    expect(hm(r.start)).toBe('9/26 07:00')
  })

  it('every week / every month take the weekday / month-day of the start', () => {
    expect(p('review finances every month on the 1st').rrule).toMatch(/^FREQ=MONTHLY/)
    expect(p('plants every week tomorrow').rrule).toBe('FREQ=WEEKLY;BYDAY=SU')
  })

  it('everything at once', () => {
    const r = p('Deep work tomorrow 9am for 2h #work !!! @focus')
    expect(r).toMatchObject({ title: 'Deep work', duration: 120, category: 'work', priority: 3, icon: 'focus', dateOnly: false })
    expect(hm(r.start)).toBe('9/27 09:00')
  })

  it('unparsed text survives as title verbatim (trimmed, capitalised)', () => {
    expect(p('  read   chapter 4 ').title).toBe('Read chapter 4')
  })
})
