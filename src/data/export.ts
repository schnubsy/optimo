// JSON export / import (docs/spec.md §2.7). Import merges with the same field-level LWW as sync and queues the
// merged rows in the outbox, so an import on one device reaches the others.

import { db } from './db'
import { toPayload, taskKind } from './repo'
import { mergeRow } from '../sync/merge'
import type { Category, Exception, OutboxRow, Settings, TableName, Task } from './types'

export interface ExportFile {
  app: 'optimo'
  version: 1
  exported_at: string
  tasks: Task[]
  categories: Category[]
  exceptions: Exception[]
  settings: Settings[]
}

export async function exportAll(): Promise<ExportFile> {
  const [tasks, categories, exceptions, settings] = await Promise.all([db.tasks.toArray(), db.categories.toArray(), db.exceptions.toArray(), db.settings.toArray()])
  const strip = <T extends object>(rows: T[]) => rows.map((r) => toPayload(r) as T)
  return { app: 'optimo', version: 1, exported_at: new Date().toISOString(), tasks: strip(tasks), categories: strip(categories), exceptions: strip(exceptions), settings: strip(settings) }
}

export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function importAll(file: ExportFile): Promise<number> {
  if (file?.app !== 'optimo' || file.version !== 1) throw new Error('Not an optimo export (version 1).')
  let n = 0
  const tables = [
    ['categories', file.categories],
    ['tasks', file.tasks],
    ['exceptions', file.exceptions],
    ['settings', file.settings],
  ] as unknown as [TableName, Record<string, unknown>[]][]
  await db.transaction('rw', [db.tasks, db.categories, db.exceptions, db.settings, db.outbox], async () => {
    for (const [table, rows] of tables) {
      const tbl = db.table(table)
      for (const incoming of rows ?? []) {
        const key = table === 'exceptions' ? [incoming.series_id, incoming.occurrence_date] : incoming.id
        const local = await tbl.get(key as never)
        const merged = (local ? mergeRow(local, incoming) : incoming) as Record<string, unknown>
        if (table === 'tasks') merged._kind = taskKind(merged as unknown as Task)
        await tbl.put(merged)
        const payload = toPayload(merged)
        const id = table === 'exceptions' ? `${merged.series_id}|${merged.occurrence_date}` : String(merged.id)
        await db.outbox.add({ table, id, op: 'upsert', payload, field_ts: (merged.field_ts ?? {}) as Record<string, number> } as OutboxRow)
        n++
      }
    }
  })
  return n
}
