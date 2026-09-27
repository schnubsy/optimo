// Per-occurrence edits (docs/spec.md §2.5): an edit to one occurrence writes an override task row
// (series_id = the series) and a planner_exceptions row keyed (series_id, occurrence_date); a skip writes
// skipped = true. "This and following" splits the series; "all" edits the series row.

import { db } from '../data/db'
import * as repo from '../data/repo'
import type { TaskInput } from '../data/repo'
import type { Task } from '../data/types'
import { addDays, dateKey, fromKey, isoAt, minutesInDay } from '../lib/time'

export type Scope = 'this' | 'following' | 'all'

/** Wall-clock start of the occurrence on `date` (series time-of-day). */
export function occurrenceStart(series: Task, date: string): string {
  const d0 = new Date(series.dtstart!)
  return isoAt(date, minutesInDay(series.dtstart!, dateKey(d0)))
}

/** RRULE with an UNTIL that ends the series before `date` (floating, end of the previous day). */
export function untilBefore(rrule: string, date: string): string {
  const prev = fromKey(addDays(date, -1))
  const stamp = `${prev.getFullYear()}${String(prev.getMonth() + 1).padStart(2, '0')}${String(prev.getDate()).padStart(2, '0')}T235959Z`
  const parts = rrule.replace(/^RRULE:/, '').split(';').filter((p) => !p.startsWith('UNTIL=') && !p.startsWith('COUNT='))
  return [...parts, `UNTIL=${stamp}`].join(';')
}

const SERIES_ONLY = ['rrule', 'dtstart'] as const

export async function editOccurrence(seriesId: string, date: string, patch: TaskInput, scope: Scope): Promise<void> {
  const series = await db.tasks.get(seriesId)
  if (!series?.rrule || !series.dtstart) return
  const ex = await db.exceptions.get([seriesId, date])
  const override = ex?.task_id ? await db.tasks.get(ex.task_id) : undefined

  if (scope === 'this') {
    if (patch.deleted_at) {
      await repo.putException(seriesId, date, { skipped: true, task_id: null })
      if (override) await repo.deleteTask(override.id)
      return
    }
    if (override && !override.deleted_at) {
      await repo.updateTask(override.id, patch)
      return
    }
    const { id: _id, field_ts: _f, device_id: _d, version: _v, updated_at: _u, _kind: _k, ...base } = series
    for (const k of SERIES_ONLY) delete (base as Record<string, unknown>)[k]
    const row = await repo.createTask({ ...base, rrule: null, dtstart: null, series_id: seriesId, start_at: occurrenceStart(series, date), completed_at: null, ...patch })
    await repo.putException(seriesId, date, { task_id: row.id, skipped: false })
    return
  }

  // new time-of-day / fields for the series going forward
  const nextStart = patch.start_at ? isoAt(date, minutesInDay(patch.start_at, dateKey(new Date(patch.start_at)))) : occurrenceStart(series, date)
  const { start_at: _s, ...rest } = patch
  if (scope === 'all') {
    const first = dateKey(new Date(series.dtstart))
    const dtstart = patch.start_at ? isoAt(first, minutesInDay(nextStart, date)) : series.dtstart
    await repo.updateTask(seriesId, { ...rest, dtstart, start_at: dtstart })
    return
  }
  // following: end this series the day before, start a new one from this occurrence
  if (date <= dateKey(new Date(series.dtstart))) {
    await repo.updateTask(seriesId, { ...rest, dtstart: nextStart, start_at: nextStart })
    return
  }
  await repo.updateTask(seriesId, { rrule: untilBefore(series.rrule, date) })
  const { id: _id, field_ts: _f, device_id: _d, version: _v, updated_at: _u, _kind: _k, ...base } = series
  await repo.createTask({ ...base, ...rest, rrule: series.rrule.replace(/;?UNTIL=[^;]+/, ''), dtstart: nextStart, start_at: nextStart, completed_at: null })
}
