import { describe, expect, it } from 'vitest'
import { parseIcs } from '../../supabase/functions/_shared/ics.ts'
import { fixtureIcs } from '../fake/caldav'

const today = new Date()
const day = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n)
const from = day(-7)
const to = day(60)
const all = () => fixtureIcs(today).flatMap((o) => parseIcs(o.ics, from, to))

describe('ICS parsing + recurrence expansion', () => {
  it('parses a single timed event with location', () => {
    const [e] = parseIcs(fixtureIcs(today)[0].ics, from, to)
    expect(e).toMatchObject({ uid: 'dentist-1', title: 'Dentist check-up', location: 'Harbour St Dental', all_day: false })
    expect(new Date(e.start_at).getHours()).toBe(10)
    expect(new Date(e.start_at).getMinutes()).toBe(30)
    expect((new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) / 60000).toBe(45)
  })
  it('expands a daily RRULE (COUNT=10) minus its EXDATE, with the moved instance at its new time', () => {
    const runs = all().filter((e) => e.uid.startsWith('school-run#'))
    expect(runs).toHaveLength(9) // 10 − 1 EXDATE
    const moved = runs.find((e) => e.title === 'School run (late start)')!
    expect(new Date(moved.start_at).getHours()).toBe(9)
    expect(new Date(moved.start_at).getDate()).toBe(day(1).getDate())
    // the EXDATE day (today + 2) has no run
    expect(runs.some((e) => new Date(e.start_at).toDateString() === day(2).toDateString())).toBe(false)
    // instance uids are unique (the account-level unique key)
    expect(new Set(runs.map((r) => r.uid)).size).toBe(runs.length)
  })
  it('keeps all-day events as all-day at local midnight', () => {
    const h = all().find((e) => e.uid === 'holiday')!
    expect(h.all_day).toBe(true)
    expect(new Date(h.start_at).getHours()).toBe(0)
    expect(new Date(h.start_at).toDateString()).toBe(day(3).toDateString())
  })
  it('clips to the window', () => {
    const narrow = fixtureIcs(today).flatMap((o) => parseIcs(o.ics, day(0), day(1)))
    expect(narrow.map((e) => e.title).sort()).toEqual(['Dentist check-up', 'School run'])
  })
  it('drops cancelled events', () => {
    const ics = fixtureIcs(today)[0].ics.replace('SUMMARY:', 'STATUS:CANCELLED\r\nSUMMARY:')
    expect(parseIcs(ics, from, to)).toEqual([])
  })
})
