import { create } from 'zustand'
import { todayKey } from '../lib/time'

export type View = 'day' | 'week' | 'month' | 'focus' | 'settings' | 'categories' | 'icons' | 'plan'
export type MobileTab = 'board' | 'backlog' | 'week'

import type { TaskInput } from '../data/repo'

/** TaskSheet in create mode, optionally prefilled (e.g. Tab from the command line). */
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

interface UI {
  view: View
  date: string
  selectedId: string | null
  editingId: string | null
  draft: Draft | null // TaskSheet in create mode
  placeId: string | null // PlacePicker open for this inbox task
  focusId: string | null
  mobileTab: MobileTab
  quickAdd: boolean // mobile quick-add sheet (FAB)
  wizard: Wizard | null // arc 6 create flow; until the wizard lands (slice 6) it opens the editor sheet in create mode
  openWizard: (mode: WizardMode, draft?: Partial<Draft>) => void
  toast: Toast | null
  set: (p: Partial<Omit<UI, 'set' | 'notify' | 'openWizard'>>) => void
  notify: (t: Omit<Toast, 'id'>) => void
}

let toastId = 0
export const useUI = create<UI>((set) => ({
  view: 'day',
  date: todayKey(),
  selectedId: null,
  editingId: null,
  draft: null,
  placeId: null,
  focusId: null,
  mobileTab: 'board',
  quickAdd: false,
  wizard: null,
  openWizard: (mode, draft = {}) =>
    // interim (slice 1): the wizard contract opens TaskSheet's create mode; slice 6 renders <Wizard> from `wizard` instead
    set({ wizard: { mode, draft }, draft: { ...draft, start_at: mode === 'inbox' ? null : (draft.start_at ?? null) }, quickAdd: false, selectedId: null }),
  toast: null,
  set: (p) => set(p),
  notify: (t) => set({ toast: { ...t, id: ++toastId } }),
}))
