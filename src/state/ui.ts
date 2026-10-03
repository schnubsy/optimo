import { create } from 'zustand'
import { todayKey } from '../lib/time'

export type View = 'day' | 'week' | 'month' | 'focus' | 'settings' | 'categories' | 'icons' | 'plan'
export type MobileTab = 'board' | 'backlog' | 'week'

import type { TaskInput } from '../data/repo'

/** TaskSheet in create mode, optionally prefilled (e.g. Tab from the command line). */
export type Draft = TaskInput & { start_at: string | null }

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
  toast: Toast | null
  set: (p: Partial<Omit<UI, 'set' | 'notify'>>) => void
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
  toast: null,
  set: (p) => set(p),
  notify: (t) => set({ toast: { ...t, id: ++toastId } }),
}))
