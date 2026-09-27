import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS, type Category, type SettingsData, type Task } from './types'

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

export function useInbox(): Task[] | undefined {
  return useLiveQuery(() => db.tasks.where('[_kind+sort_key]').between(['inbox', -Infinity], ['inbox', Infinity]).toArray(), [])
}

export function useTask(id: string | null): Task | undefined {
  return useLiveQuery(() => (id ? db.tasks.get(id) : undefined), [id])
}
