// Which reminders fire in [now, now + window): plain scheduled tasks (incl. per-occurrence override rows) and series
// occurrences, expanded in the user's own wall-clock time exactly like the client (src/recurrence/materialize.ts:
// "floating" rrule — a 09:00 series stays at 09:00 local across DST), minus skipped / overridden occurrences and
// anything already in planner_reminder_sent. Pure — runs in Deno (push-send) and Node (tests/unit/due.test.ts).
import * as RR from 'rrule'

// rrule is CJS+ESM: Node sees the named export, Deno's npm interop only the default — take whichever exists
const rrulestr: typeof RR.rrulestr = (RR as { rrulestr?: typeof RR.rrulestr }).rrulestr ?? (RR as unknown as { default: typeof RR }).default.rrulestr

export interface DueTask {
  id: string
  title: string
  start_at: string | null
  reminders: number[]
  completed_at: string | null
  deleted_at: string | null
  rrule: string | null
  dtstart: string | null
}
export interface DueException {
  series_id: string
  occurrence_date: string
  task_id: string | null
  skipped: boolean
  deleted_at: string | null
}
export interface Due {
  task_id: string
  occurrence_date: string // YYYY-MM-DD in the user's zone
  minutes_before: number
  fire_at: Date
  start: Date
  title: string
}

export const sentKey = (taskId: string, date: string, minutes: number) => `${taskId}|${date}|${minutes}`

// ---------- time zones without a library (Intl) ----------
function wall(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second }
}
const offsetMs = (d: Date, tz: string) => {
  const w = wall(d, tz)
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(d.getTime() / 1000) * 1000
}
/** The instant whose wall clock in `tz` reads y-m-d h:mi. */
export function zoned(y: number, m: number, d: number, h: number, mi: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, mi)
  let t = guess - offsetMs(new Date(guess), tz)
  const o2 = offsetMs(new Date(t), tz)
  if (guess - o2 !== t) t = guess - o2
  return new Date(t)
}
export const localDate = (d: Date, tz: string) => {
  const w = wall(d, tz)
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`
}
/** A local wall-clock as a UTC-coded Date — rrule's "floating" convention. */
const floating = (d: Date, tz: string) => {
  const w = wall(d, tz)
  return new Date(Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi))
}
const unfloat = (f: Date, tz: string) => zoned(f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate(), f.getUTCHours(), f.getUTCMinutes(), tz)

export function dueReminders(tasks: DueTask[], exceptions: DueException[], sent: Set<string>, now: Date, tz: string, windowMs = 60_000): Due[] {
  const end = now.getTime() + windowMs
  const out: Due[] = []
  const push = (task: DueTask, start: Date, date: string) => {
    for (const min of task.reminders ?? []) {
      const fire = start.getTime() - min * 60_000
      if (fire < now.getTime() || fire >= end) continue
      if (sent.has(sentKey(task.id, date, min))) continue
      out.push({ task_id: task.id, occurrence_date: date, minutes_before: min, fire_at: new Date(fire), start, title: task.title })
    }
  }
  const ex = new Map(exceptions.filter((e) => !e.deleted_at).map((e) => [`${e.series_id}|${e.occurrence_date}`, e]))
  for (const t of tasks) {
    if (t.deleted_at || t.completed_at || !t.reminders?.length) continue
    if (t.rrule && t.dtstart) {
      // an occurrence can fire up to max(lead) before it starts: expand [now, end + maxLead]
      const lead = Math.max(...t.reminders) * 60_000
      const rule = rrulestr(t.rrule.replace(/^RRULE:/, ''), { dtstart: floating(new Date(t.dtstart), tz) })
      const a = floating(new Date(now.getTime() - 86_400_000), tz)
      const b = floating(new Date(end + lead + 86_400_000), tz)
      for (const f of rule.between(a, b, true)) {
        const start = unfloat(f, tz)
        if (start.getTime() < now.getTime() || start.getTime() - lead >= end) continue
        const date = localDate(start, tz)
        const e = ex.get(`${t.id}|${date}`)
        if (e?.skipped || e?.task_id) continue // skipped, or an override row stands in (it is a plain task)
        push(t, start, date)
      }
    } else if (t.start_at) {
      const start = new Date(t.start_at)
      push(t, start, localDate(start, tz))
    }
  }
  return out.sort((x, y) => x.fire_at.getTime() - y.fire_at.getTime())
}

/** Notification copy: title = task, body "in 10 min · 14:00" / "now · 14:00", link to that day. */
export function payload(d: Due, tz: string, clock24 = true) {
  const w = wall(d.start, tz)
  const hhmm = clock24 ? `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}` : `${w.h % 12 || 12}:${String(w.mi).padStart(2, '0')} ${w.h < 12 ? 'AM' : 'PM'}`
  return {
    title: d.title || 'optimo',
    body: `${d.minutes_before ? `in ${d.minutes_before} min` : 'now'} · ${hhmm}`,
    tag: d.task_id,
    url: `/optimo/?date=${d.occurrence_date}`,
  }
}
