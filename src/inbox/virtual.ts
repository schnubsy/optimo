// Inbox list virtualisation: fixed 44 px rows, render only the visible window + overscan (docs/spec.md §2.9).

export const ROW_H = 56 // 48px row + 8px gap

export function rowWindow(scrollTop: number, viewportH: number, count: number, overscan = 8): { from: number; to: number } {
  if (!viewportH) return { from: 0, to: Math.min(count, 60) }
  const from = Math.max(0, Math.floor(scrollTop / ROW_H) - overscan)
  const to = Math.min(count, Math.ceil((scrollTop + viewportH) / ROW_H) + overscan)
  return { from, to }
}

/** Priority desc, then manual sort_key — the inbox order (docs/spec.md §2.2). */
export function inboxOrder<T extends { priority: number; sort_key: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.priority - a.priority || a.sort_key - b.sort_key)
}

/** Case-insensitive filter over title + category name. */
export function filterInbox<T extends { title: string; category_id: string | null }>(rows: T[], q: string, catName: (id: string | null) => string): T[] {
  const s = q.trim().toLowerCase()
  if (!s) return rows
  return rows.filter((r) => r.title.toLowerCase().includes(s) || catName(r.category_id).toLowerCase().includes(s))
}

/** Fractional sort key to drop `moving` just before `target` in an ordered list. */
export function keyBefore(list: { id: string; sort_key: number }[], targetId: string): number {
  const i = list.findIndex((r) => r.id === targetId)
  if (i < 0) return Date.now()
  const next = list[i].sort_key
  const prev = i > 0 ? list[i - 1].sort_key : next - 1000
  return (prev + next) / 2
}
