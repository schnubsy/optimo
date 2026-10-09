// Wizard ① suggestions (mockups 04): what Mark usually adds, learned from the last 60 days of scheduled tasks.
// Pure — the wizard passes the task rows, the clock and the typed text.
import type { Task } from '../data/types'

export interface Suggestion {
  title: string
  /** minutes after local midnight — the most common start */
  start: number
  /** the median duration */
  duration: number
  /** the most common category (null for the seed set: the wizard resolves one from the keyword map) */
  category_id: string | null
  /** how many times it was scheduled in the window (0 for seeds) */
  count: number
  seed?: boolean
}

export const SUGGESTION_WINDOW_DAYS = 60

/** Our own seed set, shown until there is history (originality rule: these strings are ours). */
export const SEED_SUGGESTIONS: Suggestion[] = [
  { title: 'Answer emails', start: 10 * 60, duration: 15, category_id: null, count: 0, seed: true },
  { title: 'Walk', start: 12 * 60 + 30, duration: 30, category_id: null, count: 0, seed: true },
  { title: 'Groceries', start: 17 * 60, duration: 60, category_id: null, count: 0, seed: true },
  { title: 'Movie night', start: 20 * 60, duration: 90, category_id: null, count: 0, seed: true },
  { title: 'Run', start: 7 * 60, duration: 60, category_id: null, count: 0, seed: true },
]

type Row = Pick<Task, 'title' | 'start_at' | 'duration_min' | 'category_id' | 'deleted_at' | 'all_day'>

/** The most frequent value; ties go to the one seen most recently (values arrive oldest → newest). */
function mode<T>(values: T[]): T {
  const n = new Map<T, { c: number; last: number }>()
  values.forEach((v, i) => n.set(v, { c: (n.get(v)?.c ?? 0) + 1, last: i }))
  let best = values[values.length - 1]
  let bc = -1
  let bl = -1
  for (const [v, { c, last }] of n) if (c > bc || (c === bc && last > bl)) [best, bc, bl] = [v, c, last]
  return best
}

/** Lower median — always a duration that was actually used. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor((s.length - 1) / 2)]
}

/**
 * Distinct titles (case-insensitive) of tasks that started in the last 60 days → most common start minute, median
 * duration, most common category; sorted by frequency, then recency; filtered by `query` (contains, case-insensitive).
 * No history at all → the seed set (also filtered).
 */
export function buildSuggestions(tasks: Row[], now: Date, query = '', limit = 8): Suggestion[] {
  const from = now.getTime() - SUGGESTION_WINDOW_DAYS * 86_400_000
  const to = now.getTime()
  const recent = tasks
    .filter((t) => t.start_at && !t.deleted_at && !t.all_day && t.title.trim())
    .map((t) => ({ t, at: new Date(t.start_at!).getTime() }))
    .filter(({ at }) => at >= from && at <= to)
    .sort((a, b) => a.at - b.at)
  const byKey = new Map<string, { title: string; last: number; starts: number[]; durs: number[]; cats: (string | null)[] }>()
  for (const { t, at } of recent) {
    const key = t.title.trim().toLowerCase()
    const d = new Date(at)
    const g = byKey.get(key) ?? { title: t.title.trim(), last: at, starts: [], durs: [], cats: [] }
    g.title = t.title.trim() // the newest spelling wins
    g.last = at
    g.starts.push(d.getHours() * 60 + d.getMinutes())
    g.durs.push(t.duration_min)
    g.cats.push(t.category_id)
    byKey.set(key, g)
  }
  const q = query.trim().toLowerCase()
  const hit = (title: string) => !q || title.toLowerCase().includes(q)
  if (!byKey.size) return SEED_SUGGESTIONS.filter((s) => hit(s.title)).slice(0, limit)
  return [...byKey.values()]
    .sort((a, b) => b.starts.length - a.starts.length || b.last - a.last)
    .filter((g) => hit(g.title))
    .slice(0, limit)
    .map((g) => {
      const cats = g.cats.filter((c): c is string => !!c)
      return { title: g.title, start: mode(g.starts), duration: median(g.durs), category_id: cats.length ? mode(cats) : null, count: g.starts.length }
    })
}
