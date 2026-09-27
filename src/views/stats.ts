import type { Item } from '../timeline/items'
import { freeRows, isLate } from '../timeline/layout'

export interface DayStats {
  planned: number
  free: number
  done: number
  total: number
  late: number
}

/** Status-strip numbers: planned and free within day bounds; late = not done and already ended (today). */
export function dayStats(items: Item[], dayStart: number, dayEnd: number, now: number | null, busy: { start: number; end: number }[] = []): DayStats {
  const timed = items.filter((i) => !i.task.all_day)
  let planned = 0
  for (const i of timed) planned += Math.max(0, Math.min(i.end, dayEnd) - Math.max(i.start, dayStart))
  // calendar events take time too (they are not tasks, so they don't count as planned or done)
  const free = freeRows([...timed, ...busy], dayStart, dayEnd, 1).reduce((a, r) => a + r.len, 0)
  const done = items.filter((i) => i.task.completed_at).length
  const late = now === null ? 0 : timed.filter((i) => isLate(i.end, !!i.task.completed_at, now)).length
  return { planned, free, done, total: items.length, late }
}
