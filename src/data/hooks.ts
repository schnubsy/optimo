import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS, type Category, type SettingsData, type Task } from './types'
import { inboxOrder } from '../inbox/virtual'
import { addDays, todayKey } from '../lib/time'

export function useSettings(): SettingsData {
  const row = useLiveQuery(() => db.settings.get('me'), [])
  return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) }
}

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('sort_key').filter((c) => !c.deleted_at).toArray(), []) ?? []
}

/** Plain scheduled tasks overlapping a local day (range query on start_at; series come from recurrence). */
export async function scheduledInRange(startIso: string, endIso: string): Promise<Task[]> {
  const rows = await db.tasks.where('start_at').between(startIso, endIso, true, false).toArray()
  return rows.filter((t) => t._kind === 'sched' || t._kind === 'override')
}

/** Inbox = kind 'inbox' only (no time, no day, not Someday), done or not, in sort_key order (the view sorts by
 *  priority via inboxOrder). Planned and Someday items left the inbox (arc 7). */
export function useInbox(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.where('[_kind+sort_key]').between(['inbox', -Infinity], ['inbox', Infinity]).toArray(), [])
}

// ---------- arc 7: inbox-first queries (db/008) — plain async functions (testable) + live hooks over them ----------

/** Unfinished inbox items — the iPhone Inbox badge. */
export function inboxCount(): Promise<number> {
  return db.tasks.where('[_kind+sort_key]').between(['inbox', -Infinity], ['inbox', Infinity]).filter((t) => !t.completed_at).count()
}

/** Someday items, priority desc then sort_key (the inbox order). */
export async function somedayList(): Promise<Task[]> {
  return inboxOrder(await db.tasks.where('[_kind+sort_key]').between(['someday', -Infinity], ['someday', Infinity]).toArray())
}

const plannedBetween = (from: string, to: string, includeTo = true) =>
  db.tasks.where('[_kind+plan_date]').between(['planned', from], ['planned', to], true, includeTo).toArray()

/**
 * The "to place" items of a day, priority desc then sort_key. Overdue roll-forward: on `today`, unfinished items
 * planned for an earlier day join (they show on today only — a past day keeps just its finished ones).
 */
export async function plannedFor(date: string, today: string = todayKey()): Promise<Task[]> {
  const rows = await plannedBetween(date, date)
  if (date < today) return inboxOrder(rows.filter((t) => t.completed_at))
  if (date > today) return inboxOrder(rows)
  const overdue = (await plannedBetween('', today, false)).filter((t) => !t.completed_at)
  return inboxOrder([...overdue, ...rows])
}

/** `plannedFor` for every day of [from, to] (inclusive), keyed YYYY-MM-DD — every day present, empty or not. */
export async function plannedRange(from: string, to: string, today: string = todayKey()): Promise<Record<string, Task[]>> {
  const out: Record<string, Task[]> = {}
  for (let d = from; d <= to; d = addDays(d, 1)) out[d] = []
  const rows = await plannedBetween(from, to)
  const rollToday = today >= from && today <= to
  if (rollToday) rows.push(...(await plannedBetween('', from, false)).filter((t) => !t.completed_at))
  for (const t of rows) {
    const day = t.plan_date! < today && !t.completed_at ? today : t.plan_date!
    if (day in out) out[day].push(t)
  }
  for (const d of Object.keys(out)) out[d] = inboxOrder(out[d])
  return out
}

export function useInboxCount(): number | undefined {
  return useLiveQuery(() => inboxCount(), [])
}

export function useSomeday(): Task[] | undefined {
  return useLiveQuery(() => somedayList(), [])
}

/** See plannedFor. `today` defaults to the device's local day at render. */
export function usePlanned(date: string, today: string = todayKey()): Task[] | undefined {
  return useLiveQuery(() => plannedFor(date, today), [date, today])
}

/** See plannedRange (the desktop week trays). */
export function usePlannedRange(from: string, to: string, today: string = todayKey()): Record<string, Task[]> | undefined {
  return useLiveQuery(() => plannedRange(from, to, today), [from, to, today])
}

export function useTask(id: string | null): Task | undefined {
  return useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id])
}
