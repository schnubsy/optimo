import { create } from 'zustand'
import { todayKey } from '../lib/time'

export type View = 'day' | 'week' | 'month' | 'focus' | 'settings' | 'categories' | 'icons' | 'plan'
export type MobileTab = 'board' | 'backlog' | 'week'

import type { TaskInput } from '../data/repo'

/** A create prefill (gap, paint, parsed command line, suggestion) — the wizard's draft. */
export type Draft = TaskInput & { start_at: string | null }

/** arc 6: the create wizard (① title → ② when → ③ details). `inbox` skips the time rows and creates unscheduled. */
export type WizardMode = 'timeline' | 'inbox'
export interface Wizard {
  mode: WizardMode
  /** prefill: a gap / paint / parsed command line / suggestion */
  draft: Partial<Draft>
}

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void | Promise<void> }
  undo?: () => void | Promise<void>
}

/** arc 6 slice 4 (iPhone): the day panel's detent — 'day' = expanded sheet, 'week' = collapsed over the week overview */
export type PanelDetent = 'day' | 'week'

interface UI {
  view: View
  panel: PanelDetent
  date: string
  selectedId: string | null
  editingId: string | null
  /** legacy create entry (Timeline createAt / FreeGap): Planner hands it to the wizard in 'timeline' mode and clears it */
  draft: Draft | null
  placeId: string | null // PlacePicker open for this inbox task
  focusId: string | null
  mobileTab: MobileTab
  /** legacy: the FAB quick-add sheet is gone (slice 6) — Planner opens the wizard when this is set and clears it */
  quickAdd: boolean
  wizard: Wizard | null // arc 6 create flow (src/editor/Wizard.tsx)
  openWizard: (mode: WizardMode, draft?: Partial<Draft>) => void
  toast: Toast | null
  set: (p: Partial<Omit<UI, 'set' | 'notify' | 'openWizard'>>) => void
  notify: (t: Omit<Toast, 'id'>) => void
}

let toastId = 0
export const useUI = create<UI>((set) => ({
  view: 'day',
  panel: 'day',
  date: todayKey(),
  selectedId: null,
  editingId: null,
  draft: null,
  placeId: null,
  focusId: null,
  mobileTab: 'board',
  quickAdd: false,
  wizard: null,
  openWizard: (mode, draft = {}) => set({ wizard: { mode, draft }, draft: null, quickAdd: false, selectedId: null, editingId: null }),
  toast: null,
  set: (p) => set(p),
  notify: (t) => set({ toast: { ...t, id: ++toastId } }),
}))
