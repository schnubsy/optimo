// User-level actions shared by drag, keyboard, the sheet and the command line. Every mutating action offers a
// 5 s undo (directions.md cross-cutting #5) — no confirm dialogs.

import { db } from './data/db'
import * as repo from './data/repo'
import type { TaskInput } from './data/repo'
import type { Task } from './data/types'
import { getSettings } from './data/repo'
import { useUI } from './state/ui'
import { fmtDur, fromKey, isoAt, minutesInDay } from './lib/time'
import { pushDown, type Span } from './timeline/layout'
import type { Item } from './timeline/items'
import { editOccurrence } from './recurrence/exceptions'

const notify = (...a: Parameters<ReturnType<typeof useUI.getState>['notify']>) => useUI.getState().notify(...a)

async function snapshot(id: string) {
  return db.tasks.get(id)
}

/** Apply a patch to an item: plain task directly; a series occurrence becomes a per-occurrence override. */
export async function patchItem(item: Pick<Item, 'task' | 'occurrence'>, patch: TaskInput, label?: string) {
  if (item.occurrence) {
    await editOccurrence(item.occurrence.seriesId, item.occurrence.date, patch, 'this')
    if (label) notify({ text: label })
    return
  }
  const before = await snapshot(item.task.id)
  await repo.updateTask(item.task.id, patch)
  if (label && before) notify({ text: label, undo: () => repo.restoreTask(before).then(() => undefined) })
}

/** Move keeps duration (spec §2.3). With push_down, later overlapping blocks shift down in one undoable step. */
export async function moveItem(item: Item, day: string, startMin: number) {
  const settings = await getSettings()
  const start_at = isoAt(day, startMin)
  if (start_at === item.task.start_at) return
  if (settings.push_down && !item.occurrence) {
    const [a, b] = [isoAt(day, 0), isoAt(day, 1440)]
    const sameDay = (await db.tasks.where('start_at').between(a, b).toArray()).filter((t) => t._kind === 'sched')
    const spans: Span[] = sameDay.map((t) => {
      const s = t.id === item.task.id ? startMin : minutesInDay(t.start_at!, day)
      return { id: t.id, start: s, end: s + t.duration_min }
    })
    if (!spans.some((s) => s.id === item.task.id)) spans.push({ id: item.task.id, start: startMin, end: startMin + item.task.duration_min })
    const next = pushDown(spans, item.task.id)
    const befores = await Promise.all(next.map((s) => snapshot(s.id)))
    for (const s of next) {
      const iso = isoAt(day, s.start)
      const cur = befores.find((b) => b?.id === s.id)
      if (cur?.start_at !== iso) await repo.updateTask(s.id, { start_at: iso })
    }
    notify({ text: 'Moved', undo: async () => { for (const b of befores) if (b) await repo.restoreTask(b) } })
    return
  }
  await patchItem(item, { start_at }, 'Moved')
}

export async function resizeItem(item: Item, duration_min: number) {
  if (duration_min === item.task.duration_min) return
  await patchItem(item, { duration_min }, `Duration ${fmtDur(duration_min)}`)
}

export async function toggleComplete(item: Pick<Item, 'task' | 'occurrence'>) {
  const t = item.task
  if (t.completed_at) {
    await patchItem(item, { completed_at: null }, 'Marked not done')
    return
  }
  const now = new Date()
  await patchItem(item, { completed_at: now.toISOString() })
  // "adjust to actual": offered, never automatic (spec §2.3)
  const actual = t.start_at ? Math.round((now.getTime() - new Date(t.start_at).getTime()) / 60000) : null
  const undo = () => patchItem(item, { completed_at: null })
  if (actual !== null && actual > 0 && Math.abs(actual - t.duration_min) >= 5 && actual < 16 * 60) {
    notify({
      text: `Done — ran ${fmtDur(actual)} vs ${fmtDur(t.duration_min)} planned`,
      action: { label: 'Adjust to actual', run: () => patchItem({ ...item, task: { ...t, completed_at: now.toISOString() } }, { duration_min: actual }) },
      undo,
    })
  } else notify({ text: 'Done', undo })
}

export async function deleteItem(item: Pick<Item, 'task' | 'occurrence'>) {
  if (item.occurrence) {
    await editOccurrence(item.occurrence.seriesId, item.occurrence.date, { deleted_at: new Date().toISOString() }, 'this')
    notify({ text: 'Occurrence skipped' })
    return
  }
  const before = await snapshot(item.task.id)
  await repo.deleteTask(item.task.id)
  useUI.getState().set({ selectedId: null, editingId: null })
  if (before) notify({ text: `Deleted “${before.title || 'Untitled'}”`, undo: () => repo.restoreTask(before).then(() => undefined) })
}

export async function unschedule(task: Task) {
  const before = await snapshot(task.id)
  await repo.updateTask(task.id, { start_at: null, sort_key: Date.now() })
  if (before) notify({ text: 'Moved to inbox', undo: () => repo.restoreTask(before).then(() => undefined) })
}

export async function schedule(task: Task, day: string, startMin: number) {
  const before = await snapshot(task.id)
  await repo.updateTask(task.id, { start_at: isoAt(day, startMin), all_day: false })
  if (before) notify({ text: `Placed at ${fromKey(day).toDateString() === new Date().toDateString() ? '' : day + ' '}${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`, undo: () => repo.restoreTask(before).then(() => undefined) })
}
