// A task's place (arc 7, db/008_inbox_first.sql) — DERIVED, never stored twice (ARC.md arc 7 RULE, spec §2.1):
//   start_at set ⇒ scheduled ('sched' / 'series' / 'override'); else someday ⇒ 'someday';
//   else plan_date set ⇒ 'planned' ("to place" on that day); else ⇒ 'inbox'.
// Pure: the repo (writes), the sync pull, import, the Dexie v5 upgrade and the tests all use these.

import type { Task, TaskKind } from './types'

/** The columns that together decide a task's place — written and stamped as one unit (field-level LWW). */
export const PLACE_FIELDS = ['start_at', 'plan_date', 'someday'] as const

/** db/008 column defaults: what a row written before 008 (or by an older client) means. */
export const TASK_DEFAULTS = { plan_date: null, someday: false, estimated: true } as const

const DAY = /^\d{4}-\d{2}-\d{2}$/
export const isDayKey = (v: unknown): v is string => typeof v === 'string' && DAY.test(v)

type KindInput = Pick<Task, 'deleted_at' | 'rrule' | 'series_id' | 'start_at'> & Partial<Pick<Task, 'plan_date' | 'someday'>>

export function taskKind(t: KindInput): TaskKind {
  if (t.deleted_at) return 'gone'
  if (t.rrule) return 'series'
  if (t.series_id) return 'override'
  if (t.start_at) return 'sched'
  if (t.someday) return 'someday'
  if (t.plan_date) return 'planned'
  return 'inbox'
}

/** Series and override rows live on the timeline only: plan_date / someday never apply to them. */
export const isRecurringRow = (t: Pick<Task, 'rrule' | 'series_id'>) => !!(t.rrule || t.series_id)

/** Fill the db/008 fields a row lacks (pre-v5 local rows, pre-008 server rows, old exports). Keeps present values. */
export function withTaskDefaults<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row }
  if (out.plan_date === undefined) out.plan_date = TASK_DEFAULTS.plan_date
  else if (typeof out.plan_date === 'string') out.plan_date = out.plan_date.slice(0, 10) // tolerate a timestamp-shaped date
  if (out.someday === undefined || out.someday === null) out.someday = TASK_DEFAULTS.someday
  if (out.estimated === undefined || out.estimated === null) out.estimated = TASK_DEFAULTS.estimated
  return out as T
}

const sets = (patch: object, k: string) => Object.prototype.hasOwnProperty.call(patch, k) && (patch as Record<string, unknown>)[k] !== undefined

/**
 * Apply the place rule to a write (`next` = before + patch). The fields the patch sets win; the fields that no longer
 * apply are cleared: a time clears plan_date + someday; Someday clears plan_date; a day clears someday; unscheduling
 * (start_at → null without naming a day or Someday) goes to the inbox. Series / override rows never carry either.
 */
export function settlePlace<T extends Pick<Task, 'start_at' | 'plan_date' | 'someday' | 'rrule' | 'series_id'>>(
  before: Partial<Pick<Task, 'start_at'>> | undefined,
  patch: object,
  next: T,
): T {
  const out = { ...next }
  if (isRecurringRow(out) || out.start_at) {
    out.plan_date = null
    out.someday = false
    return out
  }
  if (sets(patch, 'someday') && out.someday) out.plan_date = null
  else if (sets(patch, 'plan_date') && out.plan_date) out.someday = false
  else if (sets(patch, 'start_at') && before?.start_at && !sets(patch, 'plan_date') && !sets(patch, 'someday')) {
    out.plan_date = null
    out.someday = false
  } else if (out.someday && out.plan_date) out.plan_date = null // a merged mix: Someday wins, as in taskKind
  return out
}

/** An explicit new duration is an estimate: a patch that changes duration_min without naming `estimated` sets it true. */
export function settleEstimate<T extends Pick<Task, 'duration_min' | 'estimated'>>(before: Partial<Pick<Task, 'duration_min'>> | undefined, patch: object, next: T): T {
  if (sets(patch, 'estimated') || !sets(patch, 'duration_min')) return next
  if (before && before.duration_min === next.duration_min) return next
  return { ...next, estimated: true }
}

/** True when the write moved the task between places (any of PLACE_FIELDS changed). */
export function placeChanged(before: Partial<Task> | undefined, after: Partial<Task>): boolean {
  if (!before) return true
  const norm = (k: (typeof PLACE_FIELDS)[number], v: unknown) => (k === 'someday' ? !!v : (v ?? null))
  return PLACE_FIELDS.some((k) => norm(k, before[k]) !== norm(k, after[k]))
}
