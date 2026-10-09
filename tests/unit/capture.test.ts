// arc 7 slices 6 · 8 · 9 — the pure helpers behind capture → process → paint.
import { describe, expect, it } from 'vitest'
import { captureChip, captureDone, clockShort, dayWord, decideCapture, durShort } from '../../src/capture/decide'
import { fitIntent, fromTag } from '../../src/views/DayTray'
import { processKey } from '../../src/views/Inbox'
import { draftPlace } from '../../src/editor/StepDetails'
import { fmtMeta, placeName } from '../../src/editor/wizardModel'

// Friday 9 Oct 2026, 09:00 local
const REF = new Date(2026, 9, 9, 9, 0)

describe('decideCapture — the typed line → a place', () => {
  it('plain text → inbox, no estimate', () => {
    expect(decideCapture('Call plumber', REF)).toMatchObject({ place: 'inbox', title: 'Call plumber', duration: null, start: null, plan_date: null })
  })
  it('blank → null', () => {
    expect(decideCapture('   ', REF)).toBeNull()
  })
  it('"for 45m" on plain text → inbox with an estimate', () => {
    expect(decideCapture('Read chapter 4 for 45m', REF)).toMatchObject({ place: 'inbox', title: 'Read chapter 4', duration: 45 })
  })
  it('a time → timed today, with the typed length', () => {
    const d = decideCapture('Movie night at 8pm for 1.5h', REF)!
    expect(d.place).toBe('timed')
    expect(d.title).toBe('Movie night')
    expect([d.start!.getDate(), d.start!.getHours(), d.start!.getMinutes()]).toEqual([9, 20, 0])
    expect(d.duration).toBe(90)
  })
  it('a day without a time → planned for that day', () => {
    expect(decideCapture('Dentist thursday', REF)).toMatchObject({ place: 'planned', title: 'Dentist', plan_date: '2026-10-15' })
    expect(decideCapture('Pay rent tomorrow', REF)).toMatchObject({ place: 'planned', plan_date: '2026-10-10' })
  })
  it('"someday" anywhere → Someday (the word leaves the title)', () => {
    expect(decideCapture('someday learn piano', REF)).toMatchObject({ place: 'someday', title: 'Learn piano' })
    expect(decideCapture('Visit Lisbon some day', REF)).toMatchObject({ place: 'someday', title: 'Visit Lisbon' })
    expect(decideCapture('Someday: rebuild the shed', REF)).toMatchObject({ place: 'someday', title: 'Rebuild the shed' })
  })
  it('"every …" → a series, as before', () => {
    expect(decideCapture('Gym every weekday at 7am', REF)?.place).toBe('series')
  })
  it('plain (the chip was removed) files the line as typed', () => {
    expect(decideCapture('Movie night at 8pm', REF, true)).toMatchObject({ place: 'inbox', title: 'Movie night at 8pm', parsed: null })
  })
})

describe('chips and confirmations', () => {
  it('formats the time chip in both clocks', () => {
    expect(captureChip(decideCapture('Movie night at 8pm for 1.5h', REF), REF, false)).toBe('Today 8 PM · 1.5h')
    expect(captureChip(decideCapture('Movie night at 8:30pm', REF), REF, true)).toBe('Today 20:30')
    expect(captureChip(decideCapture('Lunch tomorrow at 1pm for 45m', REF), REF, false)).toBe('Tomorrow 1 PM · 45m')
  })
  it('plan / someday / plain', () => {
    expect(captureChip(decideCapture('Dentist thursday', REF), REF)).toBe('Plan for Thu')
    expect(captureChip(decideCapture('someday learn piano', REF), REF)).toBe('Someday')
    expect(captureChip(decideCapture('Call plumber', REF), REF)).toBeNull()
    expect(captureChip(null, REF)).toBeNull()
  })
  it('confirmation lines', () => {
    expect(captureDone(decideCapture('Call plumber', REF)!, REF)).toBe('Added to Inbox')
    expect(captureDone(decideCapture('someday piano', REF)!, REF)).toBe('Saved for Someday')
    expect(captureDone(decideCapture('Dentist tomorrow', REF)!, REF)).toBe('Planned for Tomorrow')
  })
  it('durShort · clockShort · dayWord', () => {
    expect([15, 60, 90, 80, 150].map(durShort)).toEqual(['15m', '1h', '1.5h', '1h 20m', '2.5h'])
    expect(clockShort(20 * 60, false)).toBe('8 PM')
    expect(clockShort(20 * 60 + 30, false)).toBe('8:30 PM')
    expect(clockShort(9 * 60, true)).toBe('09:00')
    expect(dayWord('2026-10-09', '2026-10-09')).toBe('Today')
    expect(dayWord('2026-10-10', '2026-10-09')).toBe('Tomorrow')
    expect(dayWord('2026-10-13', '2026-10-09')).toBe('Tue')
    expect(dayWord('2026-10-20', '2026-10-09')).toBe('Tue 20')
    expect(dayWord('2026-10-06', '2026-10-09')).toBe('Tue 6')
  })
})

describe('tray helpers', () => {
  it('fitIntent lists titles with the estimate, or ~ the default length', () => {
    expect(fitIntent([
      { title: 'Read the lease', duration_min: 45, estimated: true },
      { title: 'Call the bank', duration_min: 30, estimated: false },
    ])).toBe('Fit these into my day: Read the lease (45m), Call the bank (~30m)')
  })
  it('fromTag: only on today, only for earlier plan dates', () => {
    expect(fromTag('2026-10-06', '2026-10-09', '2026-10-09')).toBe('from Tue')
    expect(fromTag('2026-09-20', '2026-10-09', '2026-10-09')).toBe('from Sun 20')
    expect(fromTag('2026-10-09', '2026-10-09', '2026-10-09')).toBeNull()
    expect(fromTag('2026-10-06', '2026-10-10', '2026-10-09')).toBeNull()
    expect(fromTag(null, '2026-10-09', '2026-10-09')).toBeNull()
  })
})

describe('inbox row keys', () => {
  it('maps T / M / S / 1–4 / 0 / E and ignores the rest', () => {
    expect(processKey('t')).toEqual({ to: 'today' })
    expect(processKey('M')).toEqual({ to: 'tomorrow' })
    expect(processKey('s')).toEqual({ to: 'someday' })
    expect(['1', '2', '3', '4'].map(processKey)).toEqual([{ estimate: 15 }, { estimate: 30 }, { estimate: 60 }, { estimate: 90 }])
    expect(processKey('0')).toEqual({ estimate: null })
    expect(processKey('e')).toBe('edit')
    expect(processKey('x')).toBeNull()
    expect(processKey('5')).toBeNull()
  })
})

describe('③ place', () => {
  const today = '2026-10-09'
  it('draftPlace reads the draft', () => {
    expect(draftPlace({ inbox: false, plan_date: null, someday: false }, today)).toBe('timeline')
    expect(draftPlace({ inbox: true, plan_date: null, someday: false }, today)).toBe('inbox')
    expect(draftPlace({ inbox: true, plan_date: today, someday: false }, today)).toBe('today')
    expect(draftPlace({ inbox: true, plan_date: '2026-10-10', someday: false }, today)).toBe('tomorrow')
    expect(draftPlace({ inbox: true, plan_date: '2026-10-22', someday: false }, today)).toBe('day')
    expect(draftPlace({ inbox: true, plan_date: null, someday: true }, today)).toBe('someday')
  })
  it('the header meta names the place', () => {
    const base = { start: 0, duration: 30, all_day: false, inbox: true }
    expect(fmtMeta({ ...base }, true, today)).toBe('Inbox · 30 min')
    expect(fmtMeta({ ...base, plan_date: today }, true, today)).toBe('Today · 30 min')
    expect(fmtMeta({ ...base, someday: true }, true, today)).toBe('Someday · 30 min')
    expect(placeName({ plan_date: '2026-10-15', someday: false }, today)).toBe('Thu 15 Oct')
  })
})
