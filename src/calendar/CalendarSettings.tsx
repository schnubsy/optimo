import { useEffect, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { fmtClock } from '../lib/time'
import type { CalendarAccount } from '../data/types'
import { useUI } from '../state/ui'
import { connectICloud, disconnect, listAccounts, setCalendarEnabled, setWriteCalendar, syncCalendars } from './api'

/** Settings → Calendars: connect iCloud (Apple ID + app-specific password), per-calendar read toggles, the write
 * target ("Put optimo tasks in"), sync, disconnect. */
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
      const fresh = await listAccounts()
      setAccounts(fresh)
      const failed = fresh.find((x) => x.last_error)
      notify({ text: failed ? (failed.last_error as string) : 'Calendars synced.' })
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
          </div>
          <AccountStatus account={a} />
          {a.last_error && <p className="cal-error" role="alert">{a.last_error}</p>}
          <ul className="cal-list" aria-label={`${a.label} calendars`}>
            {a.calendars.map((c) => (
              <li key={c.href}>
                <button
                  type="button"
                  role="switch"
                  aria-checked={c.enabled}
                  className="switch-row cal-row"
                  data-testid="calendar-toggle"
                  onClick={async () => {
                    const calendars = await setCalendarEnabled(a, c.href, !c.enabled)
                    setAccounts((xs) => xs?.map((x) => (x.id === a.id ? { ...x, calendars } : x)) ?? null)
                    await syncCalendars().catch(() => undefined)
                  }}
                >
                  <span className="cal-dot" aria-hidden="true" style={c.color ? { background: c.color } : undefined} />
                  <span className="cal-name">{c.name}</span>
                  {c.shared && (
                    <span className="cal-badge" data-testid="calendar-shared">
                      Shared
                    </span>
                  )}
                  <i className="switch" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <WriteTarget
            account={a}
            onChange={async (href) => {
              await setWriteCalendar(a, href)
              setAccounts((xs) => xs?.map((x) => (x.id === a.id ? { ...x, write_calendar_href: href } : x)) ?? null)
              await syncCalendars().catch(() => undefined)
              await refresh()
            }}
          />
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

/** Honest status: what discovery found and what this device holds — never "synced" over an empty account. */
function AccountStatus({ account: a }: { account: CalendarAccount }) {
  const events = useLiveQuery(() => db.events.where('account_id').equals(a.id).count(), [a.id]) ?? 0
  const { clock24 } = useSettings()
  const found = a.calendars.length
  const at = a.last_sync_at ? new Date(a.last_sync_at) : null
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

/** "Put optimo tasks in": None, or any calendar optimo may write to (read-only shared calendars are not offered). */
function WriteTarget({ account: a, onChange }: { account: CalendarAccount; onChange: (href: string | null) => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const targets = a.calendars.filter((c) => c.writable !== false)
  const id = `cal-write-${a.id}`
  return (
    <div className="cal-write">
      <label htmlFor={id}>Put optimo tasks in</label>
      <select
        id={id}
        value={a.write_calendar_href ?? ''}
        disabled={saving}
        aria-describedby={`${id}-help`}
        data-testid="calendar-write"
        onChange={async (e) => {
          setSaving(true)
          try {
            await onChange(e.target.value || null)
          } finally {
            setSaving(false)
          }
        }}
      >
        <option value="">None — don’t write</option>
        {targets.map((c) => (
          <option key={c.href} value={c.href}>
            {c.name}
          </option>
        ))}
      </select>
      <p id={`${id}-help`} className="cal-help">
        Scheduled tasks (not repeating ones) appear in this calendar. Moving, renaming or deleting one there changes it here — deleting it there deletes the task.
      </p>
    </div>
  )
}
