import { useEffect, useState, type FormEvent } from 'react'
import type { CalendarAccount } from '../data/types'
import { useUI } from '../state/ui'
import { connectICloud, disconnect, listAccounts, setCalendarEnabled, syncCalendars } from './api'

/** Settings → Calendars: connect iCloud (Apple ID + app-specific password), per-calendar toggles, sync, disconnect. */
export function CalendarSettings() {
  const notify = useUI((s) => s.notify)
  const [accounts, setAccounts] = useState<CalendarAccount[] | null>(null)
  const [form, setForm] = useState({ username: '', password: '', label: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    listAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]))
  useEffect(() => {
    void refresh()
  }, [])

  async function onConnect(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await connectICloud({ username: form.username, password: form.password, label: form.label })
      setForm({ username: '', password: '', label: '' }) // the password leaves the device once and is not kept
      await syncCalendars()
      await refresh()
      notify({ text: 'iCloud calendar connected.' })
    } catch (err) {
      setError((err as Error).message)
      setForm((f) => ({ ...f, password: '' }))
    } finally {
      setBusy(false)
    }
  }

  async function sync() {
    setBusy(true)
    try {
      await syncCalendars()
      await refresh()
      notify({ text: 'Calendars synced.' })
    } catch (err) {
      notify({ text: (err as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <fieldset className="set-row" aria-labelledby="set-calendars-label" data-testid="calendars">
      <h3 id="set-calendars-label">Calendars</h3>
      {accounts?.map((a) => (
        <div key={a.id} className="cal-acc" data-testid="calendar-account">
          <div className="cal-acc-hd">
            <b>{a.label}</b>
            <span className="muted">{a.username}</span>
            <span className="muted">{a.last_sync_at ? `synced ${new Date(a.last_sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'not synced yet'}</span>
          </div>
          {a.last_error && <p className="cal-error" role="alert">{a.last_error}</p>}
          {a.calendars.map((c) => (
            <button
              key={c.href}
              type="button"
              role="switch"
              aria-checked={c.enabled}
              className="switch-row"
              data-testid="calendar-toggle"
              onClick={async () => {
                const calendars = await setCalendarEnabled(a, c.href, !c.enabled)
                setAccounts((xs) => xs?.map((x) => (x.id === a.id ? { ...x, calendars } : x)) ?? null)
                await syncCalendars().catch(() => undefined)
              }}
            >
              <span>{c.name}</span>
              <i className="switch" aria-hidden="true" />
            </button>
          ))}
          <div className="set-actions">
            <button type="button" className="ghost-btn" onClick={sync} disabled={busy} data-testid="calendar-sync">
              Sync now
            </button>
            <button
              type="button"
              className="ghost-btn"
              data-testid="calendar-disconnect"
              onClick={async () => {
                await disconnect(a)
                await refresh()
                notify({ text: `Disconnected ${a.label}.` })
              }}
            >
              Disconnect
            </button>
          </div>
        </div>
      ))}
      {accounts && !accounts.length && (
        <form className="cal-form" onSubmit={onConnect} data-testid="calendar-connect">
          <p className="cal-help">
            Shows your iCloud events on the timeline, read-only. Use an <b>app-specific password</b>, not your Apple ID password —
            create one at{' '}
            <a href="https://appleid.apple.com/account/manage" target="_blank" rel="noreferrer">
              appleid.apple.com → App-Specific Passwords
            </a>
            . It is sent once, encrypted on the server, and never stored on this device.
          </p>
          <label>
            Apple ID
            <input type="email" autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
          </label>
          <label>
            App-specific password
            <input type="password" autoComplete="off" placeholder="xxxx-xxxx-xxxx-xxxx" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </label>
          <label>
            Label (optional)
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="iCloud" />
          </label>
          {error && <p className="cal-error" role="alert">{error}</p>}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Connecting…' : 'Connect iCloud'}
          </button>
        </form>
      )}
    </fieldset>
  )
}
