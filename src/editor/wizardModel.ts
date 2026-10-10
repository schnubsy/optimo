// The create wizard's working draft + its display formats (shared by Wizard, the steps and the wheels).
import type { TaskInput } from '../data/repo'
import type { Priority, SettingsData, Subtask } from '../data/types'
import { dateKey, fmtClock, formatDayTitle, fromKey, isoAtZone, MIN_PER_DAY } from '../lib/time'

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
  /** arc 7 slice 6 — where an unscheduled task waits: a day ("to place", YYYY-MM-DD) or Someday; both unset = Inbox */
  plan_date: string | null
  someday: boolean
  rrule: string | null
  priority: Priority
  /** ③ details (slice 7) */
  notes: string
  subtasks: Subtask[]
  /** alert leads, minutes before start; null = not touched yet (create: the settings default applies) */
  reminders: number[] | null
  /** the zone `date` + `start` are wall-clock in (Set Timezone); null = the device zone */
  tz: string | null
  /** anything else the prefill carried — passed through to createTask */
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

/** Where an unscheduled draft waits: `Inbox` · `Someday` · `Today` · `Tomorrow` · `Thu 15 Oct`. */
export function placeName(d: Pick<WizardDraft, 'plan_date' | 'someday'>, today: string): string {
  if (d.someday) return 'Someday'
  if (!d.plan_date) return 'Inbox'
  if (d.plan_date === today) return 'Today'
  const t = fromKey(today)
  t.setDate(t.getDate() + 1)
  if (dateKey(t) === d.plan_date) return 'Tomorrow'
  return formatDayTitle(fromKey(d.plan_date)).slice(0, -5)
}

/** The header meta line: `8:00–9:30 PM (1 hr, 30 min)` · `All day` · `Inbox · 30 min` · `Today · 30 min` */
export function fmtMeta(d: Pick<WizardDraft, 'start' | 'duration' | 'all_day' | 'inbox'> & Partial<Pick<WizardDraft, 'plan_date' | 'someday'>>, clock24: boolean, today = dateKey(new Date())): string {
  if (d.inbox) return `${placeName({ plan_date: d.plan_date ?? null, someday: !!d.someday }, today)} · ${durLong(d.duration)}`
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

/** The task this draft creates or saves: ① title, ② when (in the draft's zone), ③ details. */
export function draftToInput(d: WizardDraft, settings: Pick<SettingsData, 'reminder_lead'>): TaskInput & { start_at: string | null } {
  const start_at = d.inbox ? null : isoAtZone(d.date, d.all_day ? 0 : d.start, d.all_day ? null : d.tz)
  const timed = !!start_at && !d.all_day
  return {
    ...d.extra,
    reminders: d.reminders ?? (timed && settings.reminder_lead ? [settings.reminder_lead] : []),
    notes: d.notes,
    subtasks: d.subtasks.filter((s) => s.title.trim()),
    tz: timed ? d.tz : null,
    title: d.title.trim(),
    category_id: d.category_id,
    priority: d.priority,
    start_at,
    duration_min: Math.max(0, Math.round(d.duration)),
    all_day: !!start_at && d.all_day,
    // arc 7: an unscheduled draft keeps its place (a day or Someday); a timed one clears both (repo settlePlace)
    plan_date: start_at ? null : d.plan_date,
    someday: start_at ? false : d.someday,
    sort_key: Date.now(),
    ...(d.rrule && start_at ? { rrule: d.rrule, dtstart: start_at } : {}),
  }
}
