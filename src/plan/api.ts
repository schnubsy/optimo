// The Plan tab's line to the plan-day Edge Function (arc 3). Only planning data travels: the function reads the
// day itself under the caller's JWT; the client sends the date window, zone, intent and switches.
import { FunctionsHttpError } from '@supabase/supabase-js'
import { applyRemote } from '../sync/engine'
import { supabase } from '../sync/remote'
import { dayRange } from '../lib/time'
import type { AiBlock, AiPlan, AiPlanMode } from '../data/types'

/** Why the planner can't run right now — the tab shows this instead of a broken form. */
export type PlannerDown = 'not-connected' | 'offline'

export class PlannerError extends Error {
  down: PlannerDown | null
  constructor(message: string, down: PlannerDown | null = null) {
    super(message)
    this.down = down
  }
}

async function fnError(error: unknown): Promise<PlannerError> {
  if (!navigator.onLine) return new PlannerError('You’re offline.', 'offline')
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response
    // 404: plan-day isn't deployed yet; 503 not_connected: its tables aren't applied yet
    if (res.status === 404) return new PlannerError('Planner isn’t connected yet.', 'not-connected')
    try {
      const body = await res.json()
      if (body?.code === 'not_connected') return new PlannerError('Planner isn’t connected yet.', 'not-connected')
      if (body?.error) return new PlannerError(body.error)
    } catch {
      /* not JSON */
    }
  }
  return new PlannerError('Couldn’t reach the planner — try again in a moment.')
}

function client() {
  const sb = supabase()
  if (!sb) throw new PlannerError('Planner isn’t connected yet.', 'not-connected')
  return sb
}

export interface ProposeInput {
  date: string
  intent: string
  mode: AiPlanMode
  research: boolean
  plan_id?: string
  answers?: { question: string; answer: string }[]
}

/** Ask for a plan; the returned row lands in the local store at once (the sync log brings it to other devices). */
export async function propose(input: ProposeInput): Promise<AiPlan> {
  const [from, to] = dayRange(input.date) // the device's local day — the function maps "HH:MM" onto it
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const { data, error } = await client().functions.invoke('plan-day', { body: { action: 'propose', ...input, from, to, tz } })
  if (error) throw await fnError(error)
  await applyRemote('aiPlans', [data as Record<string, unknown>])
  return data as AiPlan
}

/** Tell the planner what was kept and changed, so it learns the style. Best effort: failures stay silent. */
export async function learn(input: { plan_id: string; accepted_task_ids: string[]; edits: { before: AiBlock; after: AiBlock }[]; rejected: AiBlock[] }) {
  try {
    const { error } = await client().functions.invoke('plan-day', { body: { action: 'learn', ...input } })
    return !error
  } catch {
    return false
  }
}

/**
 * Arc 6 slice 8 — the sparkle on ③: 3–7 subtasks for one task from plan-day (`action: 'subtasks'`). Sends the task's
 * title, notes and duration only; counts against the planner's daily limit.
 */
export async function suggestSubtasks(input: { title: string; notes?: string; duration_min?: number }): Promise<string[]> {
  if (!navigator.onLine) throw new PlannerError('You’re offline.', 'offline')
  const { data, error } = await client().functions.invoke('plan-day', { body: { action: 'subtasks', ...input } })
  if (error) throw await fnError(error)
  const list = (data as { subtasks?: unknown })?.subtasks
  if (!Array.isArray(list) || !list.length) throw new PlannerError('The planner returned no usable steps — try again.')
  return list.filter((s): s is string => typeof s === 'string')
}
