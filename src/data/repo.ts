// The only write path for local data. Every write stamps field_ts for the fields it changed, and enqueues an
// outbox row in the same Dexie transaction (docs/spec.md §5.2). Deletes are tombstones (deleted_at).

import { db } from './db'
import { deviceId, newId, stamp } from './ids'
import { changedFields } from '../sync/merge'
import {
  DEFAULT_SETTINGS,
  type Category,
  type Exception,
  type OutboxRow,
  type Settings,
  type SettingsData,
  type TableName,
  type Task,
  type TaskKind,
} from './types'

type Listener = () => void
const listeners = new Set<Listener>()
/** The sync engine subscribes to schedule a push after local writes. */
export function onLocalWrite(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const notify = () => listeners.forEach((fn) => fn())

export function taskKind(t: Pick<Task, 'deleted_at' | 'rrule' | 'series_id' | 'start_at'>): TaskKind {
  if (t.deleted_at) return 'gone'
  if (t.rrule) return 'series'
  if (t.series_id) return 'override'
  return t.start_at ? 'sched' : 'inbox'
}

/** Strip local-only fields for the wire. */
export function toPayload(row: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('_')) out[k] = v
  return out
}

export function rowKey(table: TableName, row: { id?: string; series_id?: string | null; occurrence_date?: string }): string {
  if (table === 'exceptions') return `${row.series_id}|${row.occurrence_date}`
  return row.id as string
}

function stampRow<T extends { field_ts: Record<string, number>; device_id: string | null }>(
  before: T | undefined,
  after: T,
): T {
  const ts = stamp()
  const field_ts = { ...(before?.field_ts ?? {}) }
  for (const k of changedFields(before as Record<string, unknown> | undefined, after as Record<string, unknown>)) field_ts[k] = ts
  return { ...after, field_ts, device_id: deviceId(), updated_at: new Date(ts).toISOString() }
}

async function enqueue(table: TableName, row: object) {
  const payload = toPayload(row)
  const entry: OutboxRow = {
    table,
    id: rowKey(table, row as never),
    op: 'upsert',
    payload,
    field_ts: (row as { field_ts: Record<string, number> }).field_ts,
  }
  await db.outbox.add(entry)
}

// ---------- tasks ----------

export type TaskInput = Partial<Omit<Task, 'id' | 'field_ts' | 'device_id' | 'version' | 'updated_at'>>

export function blankTask(input: TaskInput = {}): Task {
  return {
    id: newId(),
    title: '',
    notes: '',
    category_id: null,
    priority: 0,
    start_at: null,
    duration_min: 30,
    all_day: false,
    completed_at: null,
    subtasks: [],
    reminders: [],
    sort_key: Date.now(),
    rrule: null,
    dtstart: null,
    series_id: null,
    deleted_at: null,
    field_ts: {},
    device_id: null,
    ...input,
  }
}

export async function createTask(input: TaskInput = {}, id?: string): Promise<Task> {
  const base = blankTask(input)
  if (id) base.id = id
  const row = stampRow(undefined, base)
  row._kind = taskKind(row)
  await db.transaction('rw', db.tasks, db.outbox, async () => {
    await db.tasks.put(row)
    await enqueue('tasks', row)
  })
  notify()
  return row
}

export async function updateTask(id: string, patch: TaskInput): Promise<Task | undefined> {
  let out: Task | undefined
  await db.transaction('rw', db.tasks, db.outbox, async () => {
    const before = await db.tasks.get(id)
    if (!before) return
    const next = { ...before, ...patch }
    if (changedFields(before as never, next as never).length === 0) return
    const after = stampRow(before, next)
    after._kind = taskKind(after)
    await db.tasks.put(after)
    await enqueue('tasks', after)
    out = after
  })
  notify()
  return out
}

export async function deleteTask(id: string) {
  return updateTask(id, { deleted_at: new Date().toISOString() })
}

export async function restoreTask(snapshot: Task) {
  const { id, field_ts: _f, device_id: _d, version: _v, updated_at: _u, _kind: _k, ...rest } = snapshot
  return updateTask(id, rest)
}

// ---------- categories ----------

export type CategoryInput = Partial<Pick<Category, 'name' | 'color' | 'icon' | 'sort_key' | 'deleted_at'>>

export async function createCategory(input: CategoryInput & { name: string }, id = newId()): Promise<Category> {
  const row = stampRow(undefined, {
    id,
    name: input.name,
    color: input.color ?? 'work',
    icon: input.icon ?? 'dot',
    sort_key: input.sort_key ?? Date.now(),
    deleted_at: null,
    field_ts: {},
    device_id: null,
  } as Category)
  await db.transaction('rw', db.categories, db.outbox, async () => {
    await db.categories.put(row)
    await enqueue('categories', row)
  })
  notify()
  return row
}

export async function updateCategory(id: string, patch: CategoryInput) {
  await db.transaction('rw', db.categories, db.outbox, async () => {
    const before = await db.categories.get(id)
    if (!before) return
    const after = stampRow(before, { ...before, ...patch })
    await db.categories.put(after)
    await enqueue('categories', after)
  })
  notify()
}

// ---------- exceptions (recurrence overrides / skips) ----------

export async function putException(series_id: string, occurrence_date: string, patch: Partial<Pick<Exception, 'task_id' | 'skipped' | 'deleted_at'>>) {
  await db.transaction('rw', db.exceptions, db.outbox, async () => {
    const before = await db.exceptions.get([series_id, occurrence_date])
    const base: Exception = before ?? {
      series_id,
      occurrence_date,
      task_id: null,
      skipped: false,
      deleted_at: null,
      field_ts: {},
      device_id: null,
    }
    const after = stampRow(before, { ...base, ...patch })
    await db.exceptions.put(after)
    await enqueue('exceptions', after)
  })
  notify()
}

// ---------- settings ----------

export async function getSettings(): Promise<SettingsData> {
  const row = await db.settings.get('me')
  return { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) }
}

export async function updateSettings(patch: Partial<SettingsData>) {
  await db.transaction('rw', db.settings, db.outbox, async () => {
    const before = await db.settings.get('me')
    const base: Settings = before ?? { id: 'me', data: { ...DEFAULT_SETTINGS }, deleted_at: null, field_ts: {}, device_id: null }
    const after = stampRow(before, { ...base, data: { ...DEFAULT_SETTINGS, ...base.data, ...patch } })
    await db.settings.put(after)
    await enqueue('settings', after)
  })
  notify()
}
