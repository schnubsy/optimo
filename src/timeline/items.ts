import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { scheduledInRange } from '../data/hooks'
import type { Task } from '../data/types'
import { dayRange, minutesInDay } from '../lib/time'
import { occurrencesInRange } from '../recurrence/materialize'

/** One block on a timeline: a plain task, or one occurrence of a series (virtual until edited). */
export interface Item {
  key: string // unique per rendered block
  task: Task
  start: number // minutes after local midnight of the day
  end: number
  occurrence?: { seriesId: string; date: string } // set for series occurrences (incl. overridden ones)
}

export function toItem(task: Task, day: string, occurrence?: Item['occurrence']): Item {
  const start = minutesInDay(task.start_at!, day)
  return { key: occurrence ? `${occurrence.seriesId}@${occurrence.date}` : task.id, task, start, end: start + task.duration_min, occurrence }
}

/** Every block for a set of days: plain scheduled tasks + materialised series occurrences (with exceptions). */
export async function loadItems(days: string[]): Promise<Record<string, Item[]>> {
  if (!days.length) return {}
  const [a] = dayRange(days[0])
  const [, b] = dayRange(days[days.length - 1])
  const [plain, series] = await Promise.all([
    scheduledInRange(a, b),
    db.tasks.where('_kind').equals('series').toArray(),
  ])
  const occ = series.length ? await occurrencesInRange(series, a, b) : []
  const out: Record<string, Item[]> = Object.fromEntries(days.map((d) => [d, []]))
  const all = [...plain.filter((t) => !t.series_id).map((t) => ({ t, o: undefined })), ...occ.map((o) => ({ t: o.task, o: o.occurrence }))]
  const bounds = days.map((d) => dayRange(d).map((x) => new Date(x).getTime()))
  for (const { t, o } of all) {
    // a block belongs to the day it starts on
    const s = new Date(t.start_at!).getTime()
    const i = bounds.findIndex(([ds, de]) => s >= ds && s < de)
    if (i >= 0) out[days[i]].push(toItem(t, days[i], o))
  }
  return out
}

export function useItems(days: string[]): Record<string, Item[]> | undefined {
  const k = days.join(',')
  return useLiveQuery(() => loadItems(days), [k])
}
