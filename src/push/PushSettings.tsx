import { useEffect, useState } from 'react'
import { useUI } from '../state/ui'
import { disablePush, enablePush, pushState, testNotification, type PushState } from './subscribe'

const COPY: Record<PushState, string> = {
  unsupported: 'This browser can’t receive push. Reminders show inside optimo while it’s open.',
  'needs-install': 'On iPhone, add optimo to your Home Screen (Share → Add to Home Screen) and open it from there to turn on reminders.',
  denied: 'Notifications are blocked for optimo. Allow them in the browser’s site settings, then come back here.',
  off: 'Get a notification before each timed task, even when optimo is closed. Lead times come from each task’s reminders.',
  on: 'On for this device. Reminders arrive as notifications; inside optimo they don’t repeat.',
}

/** Settings → Reminders: enable web push (permission → subscribe → row), send a test, turn off. */
export function PushSettings() {
  const notify = useUI((s) => s.notify)
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void pushState().then(setState)
  }, [])
  const act = async (f: () => Promise<PushState>) => {
    setBusy(true)
    try {
      setState(await f())
    } catch (e) {
      notify({ text: `Couldn’t change reminders: ${(e as Error).message}` })
    } finally {
      setBusy(false)
    }
  }
  if (!state) return null
  return (
    <fieldset className="set-row" data-testid="reminders" data-state={state}>
      <legend>Reminders</legend>
      <p className="muted">{COPY[state]}</p>
      <div className="set-actions">
        {state === 'off' && (
          <button type="button" className="primary" disabled={busy} onClick={() => act(enablePush)} data-testid="push-enable">
            Turn on notifications
          </button>
        )}
        {state === 'on' && (
          <>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => void testNotification().then(() => notify({ text: 'Test notification sent.' }))} data-testid="push-test">
              Send a test
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={() => act(disablePush)} data-testid="push-disable">
              Turn off
            </button>
          </>
        )}
      </div>
    </fieldset>
  )
}
