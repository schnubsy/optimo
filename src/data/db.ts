import Dexie, { type EntityTable } from 'dexie'
import { taskKind, withTaskDefaults } from './place'
import type { AiPlan, AiProfile, CalendarEvent, Category, Exception, MetaRow, OutboxRow, Settings, Task } from './types'

export class OptimoDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  categories!: EntityTable<Category, 'id'>
  exceptions!: Dexie.Table<Exception, [string, string]>
  settings!: EntityTable<Settings, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>
  meta!: EntityTable<MetaRow, 'key'>
  events!: EntityTable<CalendarEvent, 'id'>
  aiPlans!: EntityTable<AiPlan, 'id'>
  aiProfile!: EntityTable<AiProfile, 'id'>

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
    // arc 2: read-only calendar events pulled from planner_events via the sync log
    this.version(2).stores({ events: 'id, start_at, account_id' })
    // arc 3: AI plans (by day) and the learned planning profile — both speak the sync contract (spec §5)
    this.version(3).stores({ aiPlans: 'id, plan_date', aiProfile: 'id' })
    // arc 6 (db/007): tasks gain an optional `tz` — not indexed, so the schema is unchanged; the bump records the shape
    // and leaves every existing row as it is (no upgrade function: absent tz = the viewer's zone)
    this.version(4).stores({})
    // arc 7 (db/008): tasks gain plan_date / someday / estimated and two derived kinds ('planned', 'someday').
    // [_kind+plan_date] serves the "to place" trays (a day, a week, overdue roll-forward). The upgrade fills the
    // column defaults on every existing row — without field_ts, so any synced value outranks them — and re-derives _kind.
    this.version(5)
      .stores({ tasks: 'id, start_at, category_id, series_id, _kind, [_kind+sort_key], [_kind+start_at], [_kind+plan_date]' })
      .upgrade((tx) =>
        tx
          .table('tasks')
          .toCollection()
          .modify((t: Record<string, unknown>) => {
            Object.assign(t, withTaskDefaults(t))
            t._kind = taskKind(t as never)
          }),
      )
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
