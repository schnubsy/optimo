import { useSync } from '../state/sync'

const LABEL = { synced: 'Synced', pending: 'Pending', offline: 'Offline', error: 'Sync error', local: 'This device' } as const

export function SyncBadge() {
  const { state, pending, error } = useSync()
  const text = state === 'pending' ? `${LABEL.pending} ${pending}` : state === 'offline' && pending ? `Offline, ${pending} queued` : LABEL[state]
  return (
    <span className={`sync-badge sync-${state}`} role="status" aria-live="polite" title={error ?? undefined} data-testid="sync-badge" data-state={state}>
      <i aria-hidden="true" />
      {text}
    </span>
  )
}
