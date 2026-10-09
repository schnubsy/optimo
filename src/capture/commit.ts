// arc 7 slice 8 — file a capture decision (the iPhone capture sheet and the desktop command line share it).
import * as repo from '../data/repo'
import type { Category, SettingsData, Task } from '../data/types'
import { resolveCategory, toInput } from '../quickadd/QuickAdd'
import type { CaptureDecision } from './decide'

export async function commitCapture(d: CaptureDecision, cats: Category[], settings: Pick<SettingsData, 'default_duration'>): Promise<Task> {
  const p = d.parsed
  if ((d.place === 'timed' || d.place === 'series') && p) {
    // as the command line always did: the parsed fields, the default length when none was typed
    return repo.createTask(toInput(p, resolveCategory(p, cats), settings.default_duration))
  }
  const cat = p ? resolveCategory(p, cats) : null
  return repo.captureToInbox(d.title, {
    ...(d.duration ? { duration_min: d.duration } : {}),
    ...(cat ? { category_id: cat.id } : {}),
    ...(p?.priority ? { priority: p.priority } : {}),
    ...(d.place === 'planned' ? { plan_date: d.plan_date } : {}),
    ...(d.place === 'someday' ? { someday: true } : {}),
  })
}
