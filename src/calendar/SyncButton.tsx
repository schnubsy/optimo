// arc 5a slice 2 — the Settings → Calendars sync control, rendered from the one shared sync status, so a press, the
// after-push trigger and the background runs all look the same: "Sync now" → spinner + "Syncing…" (disabled) →
// "Synced · N events · N sent to iCloud" for 4 s → "Sync now"; a failure shows the reason in red and the button reads "Retry".
import { NO_CALENDARS_REASON, doneText, useSyncStatus } from './syncStatus'
import './syncbutton.css'

export function SyncButton({ onSync }: { onSync: () => void | Promise<void> }) {
  const status = useSyncStatus((s) => s.status)
  const syncing = status.kind === 'syncing'
  // #58 (slice 3): "no calendars on this Apple ID" is said once, by the account's empty state — no red line here
  const quiet = status.kind === 'failed' && status.reason === NO_CALENDARS_REASON
  const failed = status.kind === 'failed' && !quiet
  const label =
    status.kind === 'syncing' ? 'Syncing…' : status.kind === 'done' ? doneText(status.events, status.pushed) : quiet ? 'Sync again' : failed ? 'Retry' : 'Sync now'
  const said = status.kind === 'syncing' ? 'Syncing calendars…' : status.kind === 'done' ? doneText(status.events, status.pushed) : ''
  return (
    <>
      <button
        type="button"
        className="ghost-btn sync-btn"
        data-state={status.kind}
        data-testid="calendar-sync"
        onClick={() => void onSync()}
        disabled={syncing}
        aria-busy={syncing}
        aria-describedby={failed ? 'calendar-sync-reason' : undefined}
      >
        {syncing && <i className="sync-spin" aria-hidden="true" />}
        {label}
      </button>
      <p className="sync-fb" role="status" aria-live="polite" data-testid="calendar-sync-status">
        {failed && status.kind === 'failed' ? (
          <span id="calendar-sync-reason" className="sync-fb-err" data-testid="calendar-sync-error">
            {status.reason}
          </span>
        ) : (
          <span className="sr-only">{said}</span>
        )}
      </p>
    </>
  )
}
