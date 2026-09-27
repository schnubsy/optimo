import Dexie, { type EntityTable } from 'dexie'
import type { Category, Exception, MetaRow, OutboxRow, Settings, Task } from './types'

export class OptimoDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  categories!: EntityTable<Category, 'id'>
  exceptions!: Dexie.Table<Exception, [string, string]>
  settings!: EntityTable<Settings, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>
  meta!: EntityTable<MetaRow, 'key'>

  constructor(name = 'optimo') {
    super(name)
    this.version(1).stores({
      // start_at: day-range queries; [_kind+sort_key]: inbox order; series rows by _kind; overrides by series_id
      tasks: 'id, start_at, category_id, series_id, _kind, [_kind+sort_key], [_kind+start_at]',
      categories: 'id, sort_key',
      exceptions: '[series_id+occurrence_date], series_id, task_id',
      settings: 'id',
      outbox: '++seq, [table+id]',
      meta: 'key',
    })
  }
}

export let db = new OptimoDB()

/** Tests swap in a fresh database. */
export function useDatabase(next: OptimoDB) {
  db = next
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return (row?.value as T) ?? fallback
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value })
}
