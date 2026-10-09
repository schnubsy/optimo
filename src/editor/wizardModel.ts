// The create wizard's working draft + its display formats (shared by Wizard, the steps and the wheels).
import type { TaskInput } from '../data/repo'
import type { Priority, SettingsData } from '../data/types'
import { fmtClock, isoAt, MIN_PER_DAY } from '../lib/time'

export type WizardStep = 1 | 2 | 3

/** What the wizard is building. `start` is minutes after local midnight of `date`. */
export interface WizardDraft {
  title: string
  category_id: string | null
  date: string // YYYY-MM-DD
  start: number
  duration: number
  all_day: boolean
  /** true = unscheduled (Add to Inbox / the inbox pill): no time rows, start_at null */
  inbox: boolean
  rrule: string | null
  priority: Priority
  /** anything else the prefill carried (notes, subtasks, reminders) — passed through to createTask */
  extra: TaskInput
}

/** `1 hr, 30 min` · `15 min` · `2 hr` */
export function durLong(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} hr, ${r} min` : `${h} hr`
}

/** `8:00–9:30 PM` (one meridiem when both ends share it) · `11:30 AM–1:00 PM` · `20:00–21:30` */
export function fmtRange(start: number, duration: number, clock24: boolean): string {
  const end = start + duration
  if (clock24) return `${fmtClock(start, true)}–${fmtClock(end, true)}`
  const a = fmtClock(start, false)
  const b = fmtClock(end, false)
  if (!duration) return a
  const [at, am] = a.split(' ')
  const [, bm] = b.split(' ')
  const sameDay = Math.floor(start / MIN_PER_DAY) === Math.floor(end / MIN_PER_DAY) || end % MIN_PER_DAY === 0
  return am === bm && sameDay ? `${at}–${b}` : `${a}–${b}`
}

/** The header meta line: `8:00–9:30 PM (1 hr, 30 min)` · `All day` · `Inbox · 30 min` */
export function fmtMeta(d: Pick<WizardDraft, 'start' | 'duration' | 'all_day' | 'inbox'>, clock24: boolean): string {
  if (d.inbox) return `Inbox · ${durLong(d.duration)}`
  if (d.all_day) return 'All day'
  return `${fmtRange(d.start, d.duration, clock24)} (${durLong(d.duration)})`
}

/** Quick-row label: `1 · 15 · 30 · 45 · 1h · 1.5h · 2h · 1h 20` */
export function presetShort(min: number): string {
  if (min < 60) return String(min)
  if (min % 60 === 0) return `${min / 60}h`
  if (min % 30 === 0) return `${min / 60}h`
  return `${Math.floor(min / 60)}h ${min % 60}`
}

/** Duration-sheet chip label: `1m · 15m · 1h · 1h 30m` */
export function presetChip(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** The task this draft creates (slice 7's details add notes / subtasks / alerts on top). */
export function draftToInput(d: WizardDraft, settings: Pick<SettingsData, 'reminder_lead'>): TaskInput & { start_at: string | null } {
  const start_at = d.inbox ? null : isoAt(d.date, d.all_day ? 0 : d.start)
  const timed = !!start_at && !d.all_day
  return {
    reminders: timed && settings.reminder_lead ? [settings.reminder_lead] : [],
    ...d.extra,
    title: d.title.trim(),
    category_id: d.category_id,
    priority: d.priority,
    start_at,
    duration_min: Math.max(0, Math.round(d.duration)),
    all_day: !!start_at && d.all_day,
    sort_key: Date.now(),
    ...(d.rrule && start_at ? { rrule: d.rrule, dtstart: start_at } : {}),
  }
}
