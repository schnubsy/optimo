import { create } from 'zustand'

/** Live drag feedback — kept out of the main UI store so only the ghost re-renders during a drag. */
interface DragStore {
  ghost: { day: string; start: number; len: number } | null
  activeId: string | null
  nearBar: boolean // a dragged pill is within 80px of the floating tab bar → the bar recedes
  set: (p: Partial<Omit<DragStore, 'set'>>) => void
}
export const useDrag = create<DragStore>((set) => ({ ghost: null, activeId: null, nearBar: false, set: (p) => set(p) }))
