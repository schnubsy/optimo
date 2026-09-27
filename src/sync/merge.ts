// Field-level last-writer-wins — the exact algorithm of planner_merge() in db/001_planner.sql.
// `stored` is the row already held (server row on push, local row on pull); `incoming` is the arriving row.
// For each field: incoming ts < stored ts ⇒ keep stored value; otherwise take incoming; field_ts keeps the max.
// Pure: used by the client pull, the unit tests and the hermetic test server alike.

import type { FieldTs } from '../data/types'

/** Keys the SQL merge never arbitrates (identity + server bookkeeping). */
export const MERGE_SKIP = new Set(['id', 'user_id', 'version', 'updated_at', 'field_ts', 'series_id', 'occurrence_date'])

type Row = Record<string, unknown> & { field_ts?: FieldTs }

export function mergeRow<T extends Row>(stored: T, incoming: Row): T {
  const merged: Record<string, unknown> = { ...stored, ...incoming }
  const sTs = stored.field_ts ?? {}
  const iTs = incoming.field_ts ?? {}
  const ts: FieldTs = { ...sTs }
  for (const k of Object.keys(stored)) {
    if (MERGE_SKIP.has(k) || k.startsWith('_')) continue
    const tIn = iTs[k] ?? 0
    const tOld = sTs[k] ?? 0
    if (tIn < tOld) merged[k] = stored[k] ?? null
    else if (tIn > tOld) ts[k] = tIn
  }
  merged.field_ts = ts
  return merged as T
}

/** Fields whose value changed between two rows (JSON-deep compare), ignoring sync bookkeeping. */
export function changedFields(before: Row | undefined, after: Row): string[] {
  const out: string[] = []
  for (const k of Object.keys(after)) {
    if (MERGE_SKIP.has(k) || k.startsWith('_') || k === 'device_id') continue
    if (!before || JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null)) out.push(k)
  }
  return out
}
