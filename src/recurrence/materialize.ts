// Series are materialised on read for the visible range (docs/spec.md §2.5). rrule works in "floating" time:
// dtstart is fed as a UTC date carrying the LOCAL wall-clock, and results are read back the same way, so a
// 09:00 series stays at 09:00 local across DST changes.

import { rrulestr } from 'rrule'
import { db } from '../data/db'
import type { Exception, Task } from '../data/types'
import { dateKey } from '../lib/time'

export interface Occurrence {
  task: Task
  occurrence: { seriesId: string; date: string }
}

const floating = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()))
const unfloat = (d: Date) => new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes())

/** Local start instants of a series between [from, to). */
export function expand(rrule: string, dtstartIso: string, from: Date, to: Date): Date[] {
  const rule = rrulestr(rrule.replace(/^RRULE:/, ''), { dtstart: floating(new Date(dtstartIso)) })
  // widen by a day each side: floating ↔ local offsets never exceed that
  const a = floating(new Date(from.getTime() - 86_400_000))
  const b = floating(new Date(to.getTime() + 86_400_000))
  return rule
    .between(a, b, true)
    .map(unfloat)
    .filter((d) => d >= from && d < to)
}

/** The occurrence-date key used by planner_exceptions for an occurrence start. */
export const occurrenceKey = (start: Date) => dateKey(start)

/** Pure core: series + their exceptions + override rows → occurrences in range. */
export function materialize(series: Task[], exceptions: Exception[], overrides: Task[], fromIso: string, toIso: string): Occurrence[] {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const ex = new Map(exceptions.filter((e) => !e.deleted_at).map((e) => [`${e.series_id}|${e.occurrence_date}`, e]))
  const byId = new Map(overrides.map((o) => [o.id, o]))
  const out: Occurrence[] = []
  for (const s of series) {
    if (s.deleted_at || !s.rrule || !s.dtstart) continue
    for (const start of expand(s.rrule, s.dtstart, from, to)) {
      const date = occurrenceKey(start)
      const e = ex.get(`${s.id}|${date}`)
      if (e?.skipped || e?.task_id) continue // skipped, or an override row stands in (placed by its own start_at)
      out.push({ task: { ...s, start_at: start.toISOString(), completed_at: null }, occurrence: { seriesId: s.id, date } })
    }
  }
  // overrides land wherever they were moved to
  for (const e of ex.values()) {
    if (!e.task_id || e.skipped) continue
    const o = byId.get(e.task_id)
    const s = series.find((x) => x.id === e.series_id)
    if (!o || o.deleted_at || !o.start_at || !s || s.deleted_at) continue
    const t = new Date(o.start_at)
    if (t >= from && t < to) out.push({ task: { ...o, rrule: s.rrule, dtstart: s.dtstart }, occurrence: { seriesId: s.id, date: e.occurrence_date } })
  }
  return out
}

export async function occurrencesInRange(series: Task[], fromIso: string, toIso: string): Promise<Occurrence[]> {
  const ids = series.map((s) => s.id)
  const [exceptions, overrides] = await Promise.all([
    db.exceptions.where('series_id').anyOf(ids).toArray(),
    db.tasks.where('series_id').anyOf(ids).toArray(),
  ])
  return materialize(series, exceptions, overrides, fromIso, toIso)
}
