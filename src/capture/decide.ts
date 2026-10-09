// arc 7 slice 8 — one-line capture: what a typed line becomes (pure, unit-tested in tests/unit/capture.test.ts).
// The quick-add parser still runs; its findings only decide the place:
//   a time            ⇒ 'timed'   (scheduled at that time, the parsed or default length)
//   "every …"         ⇒ 'series'  (a repeating block, as before)
//   "someday"         ⇒ 'someday' (no day, no time)
//   a day, no time    ⇒ 'planned' ("to place" on that day, untimed)
//   anything else     ⇒ 'inbox'   (untimed; an estimate only when "for 45m" was typed)
// `plain` (the chip was removed) files the line as typed into the inbox, nothing parsed.

import { parseQuickAdd, type Parsed } from '../quickadd/parse'
import { dateKey, fmtClock, fromKey, shortDay } from '../lib/time'

export type CapturePlace = 'inbox' | 'planned' | 'someday' | 'timed' | 'series'

export interface CaptureDecision {
  place: CapturePlace
  title: string
  /** 'planned': the day (YYYY-MM-DD) */
  plan_date: string | null
  /** 'timed' / 'series': the start */
  start: Date | null
  /** typed length ("for 45m"), minutes — an estimate when untimed */
  duration: number | null
  parsed: Parsed | null
}

const SOMEDAY = /(^|\s)some\s?day[:;,.!—-]*(?=\s|$)/i

export function decideCapture(input: string, ref = new Date(), plain = false): CaptureDecision | null {
  const raw = input.replace(/\s+/g, ' ').trim()
  if (!raw) return null
  if (plain) return { place: 'inbox', title: raw, plan_date: null, start: null, duration: null, parsed: null }
  const someday = SOMEDAY.test(raw)
  const p = parseQuickAdd(someday ? raw.replace(SOMEDAY, ' ') : raw, ref)
  if (!p.title) return null
  const base = { title: p.title, plan_date: null, start: null, duration: p.duration, parsed: p }
  if (p.rrule && p.start) return { ...base, place: 'series', start: p.start }
  if (someday) return { ...base, place: 'someday' }
  if (p.start && !p.dateOnly) return { ...base, place: 'timed', start: p.start }
  if (p.start) return { ...base, place: 'planned', plan_date: dateKey(p.start) }
  return { ...base, place: 'inbox' }
}

/** `8 PM` · `8:30 PM` · `20:00` */
export function clockShort(min: number, clock24: boolean): string {
  const s = fmtClock(min, clock24)
  return clock24 ? s : s.replace(':00 ', ' ')
}

/** `15m` · `1h` · `1.5h` · `1h 20m` — the compact estimate voice (chips, tray). */
export function durShort(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m}m`
  if (m % 30 === 0) return `${m / 60}h`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

/** `Today` · `Tomorrow` · `Thu` (within the coming week) · `Thu 22` (further out or earlier). */
export function dayWord(key: string, today: string): string {
  if (key === today) return 'Today'
  const diff = Math.round((fromKey(key).getTime() - fromKey(today).getTime()) / 86_400_000)
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const d = fromKey(key)
  return diff > 1 && diff < 7 ? shortDay(d).split(' ')[0] : shortDay(d)
}

/** The chip shown before Enter — null for a plain inbox capture (nothing to undo). */
export function captureChip(d: CaptureDecision | null, ref = new Date(), clock24 = true): string | null {
  if (!d) return null
  const today = dateKey(ref)
  if (d.place === 'someday') return 'Someday'
  if (d.place === 'planned') return `Plan for ${dayWord(d.plan_date!, today)}`
  if (d.place === 'timed' || d.place === 'series') {
    const s = d.start!
    const at = d.parsed?.dateOnly ? '' : ` ${clockShort(s.getHours() * 60 + s.getMinutes(), clock24)}`
    const when = d.place === 'series' ? `${cap(d.parsed?.repeatLabel ?? 'repeats')}${at}` : `${dayWord(dateKey(s), today)}${at}`
    return d.duration ? `${when} · ${durShort(d.duration)}` : when
  }
  return null
}

/** What the confirmation line says after Enter. */
export function captureDone(d: CaptureDecision, ref = new Date(), clock24 = true): string {
  if (d.place === 'inbox') return 'Added to Inbox'
  if (d.place === 'someday') return 'Saved for Someday'
  if (d.place === 'planned') return `Planned for ${dayWord(d.plan_date!, dateKey(ref))}`
  return `Added · ${captureChip(d, ref, clock24)}`
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)
