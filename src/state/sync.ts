import { create } from 'zustand'

export type SyncState = 'synced' | 'pending' | 'offline' | 'error' | 'local'

interface SyncStore {
  state: SyncState
  pending: number
  lastSync: number | null
  error: string | null
  set: (p: Partial<Omit<SyncStore, 'set'>>) => void
}

export const useSync = create<SyncStore>((set) => ({
  state: 'synced',
  pending: 0,
  lastSync: null,
  error: null,
  set: (p) => set(p),
}))
