import { create } from 'zustand'

/** Where a drop will land: a day (`where: 'day'` = the day spine, 'week' = a week column), its start and length. */
export interface DropGhost {
  day: string
  start: number
  len: number
  where: 'day' | 'week'
}

/** Live drag feedback — kept out of the main UI store so only the ghost re-renders during a drag. */
interface DragStore {
  ghost: DropGhost | null
  activeId: string | null
  nearBar: boolean // a dragged pill is within 80px of the floating tab bar → the bar recedes
  set: (p: Partial<Omit<DragStore, 'set'>>) => void
}
export const useDrag = create<DragStore>((set) => ({ ghost: null, activeId: null, nearBar: false, set: (p) => set(p) }))
