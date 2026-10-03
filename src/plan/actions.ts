// Turning a proposal into real tasks. Accepted blocks become ordinary tasks through the outbox (repo.createTask), the
// plan row records which tasks it produced, and Undo tombstones exactly those tasks — nothing else on the day.
import * as repo from '../data/repo'
import { getSettings } from '../data/repo'
import type { AiBlock, AiPlan, Priority } from '../data/types'
import { fromKey, shortDay } from '../lib/time'
import { useUI } from '../state/ui'
import { learn } from './api'

export interface Decision {
  /** index into plan.proposal.blocks → the block as Mark left it (edited or not) */
  kept: Map<number, AiBlock>
}

async function createFrom(blocks: AiBlock[]): Promise<string[]> {
  const s = await getSettings()
  const ids: string[] = []
  for (const b of blocks) {
    const t = await repo.createTask({
      title: b.title,
      start_at: b.start_at,
      duration_min: b.duration_min,
      category_id: b.category_id ?? null,
      priority: (b.priority ?? 0) as Priority,
      reminders: s.reminder_lead ? [s.reminder_lead] : [],
    })
    ids.push(t.id)
  }
  return ids
}

/** Tombstone exactly the tasks a plan produced, and put the plan back to `to`. */
export async function undoPlan(plan: AiPlan, ids: string[], to: AiPlan['status']) {
  for (const id of ids) await repo.deleteTask(id)
  await repo.updateAiPlan(plan.id, { status: to, accepted_task_ids: [] })
}

const same = (a: AiBlock, b: AiBlock) => a.title === b.title && a.start_at === b.start_at && a.duration_min === b.duration_min && (a.category_id ?? null) === (b.category_id ?? null)

/** Accept all or some (possibly edited) blocks; fires `learn` with what was kept, changed and left out. */
export async function acceptPlan(plan: AiPlan, d: Decision): Promise<string[]> {
  const order = [...d.kept.keys()].sort((a, b) => a - b)
  const blocks = order.map((i) => d.kept.get(i)!)
  const ids = await createFrom(blocks)
  await repo.updateAiPlan(plan.id, { status: 'accepted', accepted_task_ids: ids })
  const edits = order.filter((i) => !same(plan.proposal.blocks[i], d.kept.get(i)!)).map((i) => ({ before: plan.proposal.blocks[i], after: d.kept.get(i)! }))
  const rejected = plan.proposal.blocks.filter((_, i) => !d.kept.has(i))
  void learn({ plan_id: plan.id, accepted_task_ids: ids, edits, rejected })
  useUI.getState().notify({ text: `Added ${ids.length} block${ids.length === 1 ? '' : 's'} to ${shortDay(fromKey(plan.plan_date))}`, undo: () => undoPlan(plan, ids, 'draft') })
  return ids
}

/** Auto mode: the whole proposal goes straight in; one-tap Undo removes exactly those tasks. */
export async function applyPlan(plan: AiPlan): Promise<string[]> {
  const ids = await createFrom(plan.proposal.blocks)
  await repo.updateAiPlan(plan.id, { status: 'applied', accepted_task_ids: ids })
  useUI.getState().notify({ text: `Planned ${ids.length} block${ids.length === 1 ? '' : 's'} into ${shortDay(fromKey(plan.plan_date))}`, undo: () => undoPlan(plan, ids, 'rejected') })
  return ids
}

export async function rejectPlan(plan: AiPlan) {
  await repo.updateAiPlan(plan.id, { status: 'rejected' })
}
