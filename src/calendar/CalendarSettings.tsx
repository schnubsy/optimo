import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { fmtClock } from '../lib/time'
import type { CalendarAccount } from '../data/types'
import { useUI } from '../state/ui'
import { connectICloud, disconnect, listAccounts, syncCalendars } from './api'
import { CalendarRoles } from './CalendarRoles'
import { SyncButton } from './SyncButton'

/** Settings → Calendars: connect iCloud (Apple ID + app-specific password), one role per calendar (Off · Show in
 * optimo · Two-way — CalendarRoles), sync, disconnect. */
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

  /** The SyncButton shows progress / result / reason from the shared sync status (no toast); refresh the rows after. */
  async function sync() {
    // #58: an Apple ID with no calendars is said once — by the account's empty state; the button just offers "Sync again"
    await syncCalendars().catch(() => undefined)
    await refresh()
  }

  return (
    <fieldset className="set-row" aria-labelledby="set-calendars-label" data-testid="calendars">
      <h3 id="set-calendars-label">Calendars</h3>
      {accounts?.map((a) => (
        <div key={a.id} className="cal-acc" data-testid="calendar-account">
          <div className="cal-acc-hd">
            <b>{a.label}</b>
            <span className="muted">{a.username}</span>
          </div>
          <AccountStatus account={a} />
          {a.last_error && !isEmptyAccount(a) && <p className="cal-error" role="alert">{a.last_error}</p>}
          <CalendarRoles account={a} onChange={(next) => setAccounts((xs) => xs?.map((x) => (x.id === next.id ? next : x)) ?? null)} />
          <div className="set-actions">
            <SyncButton onSync={sync} />
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
            Shows your iCloud events on the timeline, and can write timed tasks into one calendar you choose. Use an <b>app-specific password</b>, not your Apple ID password —
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

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

/** The server's last_error for an Apple ID with no event calendars (supabase/functions/_shared/handlers.ts NO_CALENDARS). */
const NO_CALENDARS = 'No calendars found on this Apple ID'
/** Discovery found no calendars and nothing else went wrong — the #58 empty state. */
const isEmptyAccount = (a: CalendarAccount) => !a.calendars.length && (!a.last_error || a.last_error === NO_CALENDARS)

/** Honest status: what discovery found and what this device holds — never "synced" over an empty account. With no
 * calendars it is ONE message with a next step (#58), not a status line + an alert + a toast. */
function AccountStatus({ account: a }: { account: CalendarAccount }) {
  const events = useLiveQuery(() => db.events.where('account_id').equals(a.id).count(), [a.id]) ?? 0
  const { clock24 } = useSettings()
  const found = a.calendars.length
  const at = a.last_sync_at ? new Date(a.last_sync_at) : null
  if (isEmptyAccount(a))
    return (
      <p className="cal-empty" role="status" data-testid="calendar-empty">
        No calendars on this Apple ID. Check that Calendars is turned on in iCloud settings on your iPhone or Mac, then sync again.
      </p>
    )
  return (
    <p className="cal-status muted" data-testid="calendar-status">
      {found ? <span data-testid="calendar-found">Found {plural(found, 'calendar')}</span> : <span data-testid="calendar-none">No calendars found</span>}
      <span aria-hidden="true"> · </span>
      <span data-testid="calendar-synced">
        {at ? `synced ${fmtClock(at.getHours() * 60 + at.getMinutes(), clock24)} · ${plural(events, 'event')}` : 'not synced yet'}
      </span>
    </p>
  )
}
