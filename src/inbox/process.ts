// arc 7 slices 8–9 — processing: give an inbox / tray / Someday item a place (or an estimate), with a 5 s undo.
// The place rule lives in the repo (planForDay / toSomeday / toInbox / setEstimate) — this only adds the voice.
import { db } from '../data/db'
import * as repo from '../data/repo'
import type { Task } from '../data/types'
import { addDays, todayKey } from '../lib/time'
import { useUI } from '../state/ui'
import { dayWord, durShort } from '../capture/decide'

export type ProcessTo = { to: 'day'; date: string } | { to: 'today' } | { to: 'tomorrow' } | { to: 'someday' } | { to: 'inbox' }

const name = (t: Pick<Task, 'title'>) => `“${t.title || 'Untitled'}”`

export async function processTo(task: Pick<Task, 'id' | 'title'>, where: ProcessTo): Promise<void> {
  const before = await db.tasks.get(task.id)
  if (!before) return
  const today = todayKey()
  let text: string
  if (where.to === 'someday') {
    await repo.toSomeday(task.id)
    text = `${name(task)} → Someday`
  } else if (where.to === 'inbox') {
    await repo.toInbox(task.id)
    text = `${name(task)} → Inbox`
  } else {
    const date = where.to === 'today' ? today : where.to === 'tomorrow' ? addDays(today, 1) : where.date
    await repo.planForDay(task.id, date)
    text = `${name(task)} → ${dayWord(date, today)}`
  }
  useUI.getState().notify({ text, undo: () => repo.restoreTask(before).then(() => undefined) })
}

/** Minutes, or null for "no estimate yet". */
export async function estimate(task: Pick<Task, 'id' | 'title'>, minutes: number | null): Promise<void> {
  const before = await db.tasks.get(task.id)
  if (!before) return
  await repo.setEstimate(task.id, minutes)
  useUI.getState().notify({ text: minutes ? `${name(task)} · ${durShort(minutes)}` : `${name(task)} · no estimate`, undo: () => repo.restoreTask(before).then(() => undefined) })
}

/** The processing presets: the estimate chips (15 · 30 · 60 · 90 · ?) and their keys (1–4, 0). */
export const ESTIMATES = [15, 30, 60, 90] as const
