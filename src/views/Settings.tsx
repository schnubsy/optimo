import { useRef, useState } from 'react'
import { useSettings } from '../data/hooks'
import { updateSettings } from '../data/repo'
import type { SettingsData } from '../data/types'
import { downloadJson, exportAll, importAll, type ExportFile } from '../data/export'
import { signOut } from '../auth/session'
import { fmtClock, todayKey } from '../lib/time'
import { useUI } from '../state/ui'
import '../categories/categories.css'

const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const toMin = (v: string) => {
  const [h, m] = v.split(':').map(Number)
  return h * 60 + m
}

function Seg<T extends string | number | boolean>({ label, value, options, onChange, name }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; name: string }) {
  return (
    <fieldset className="set-row seg" data-testid={`set-${name}`}>
      <legend>{label}</legend>
      <div>
        {options.map(([v, l]) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function Settings() {
  const s = useSettings()
  const set = useUI((x) => x.set)
  const notify = useUI((x) => x.notify)
  const file = useRef<HTMLInputElement>(null)
  const [perm, setPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission))
  const up = (p: Partial<SettingsData>) => void updateSettings(p)

  return (
    <section className="page settings" aria-labelledby="set-h" tabIndex={-1}>
      <h2 id="set-h">Settings</h2>
      <p className="muted">Synced to every device signed in to this account.</p>

      <Seg name="theme" label="Theme" value={s.theme} options={[['system', 'System'], ['dark', 'Dark'], ['light', 'Light']]} onChange={(v) => up({ theme: v })} />

      <div className="set-grid">
        <label className="set-row">
          <span>Day starts</span>
          <input type="time" step={900} value={hh(s.day_start)} onChange={(e) => e.target.value && up({ day_start: toMin(e.target.value) })} />
        </label>
        <label className="set-row">
          <span>Day ends</span>
          <input type="time" step={900} value={hh(s.day_end)} onChange={(e) => e.target.value && up({ day_end: toMin(e.target.value) })} />
        </label>
        <label className="set-row">
          <span>Default duration (min)</span>
          <input type="number" min={5} step={5} value={s.default_duration} onChange={(e) => up({ default_duration: Math.max(5, Number(e.target.value)) })} />
        </label>
        <label className="set-row">
          <span>Default reminder for new timed tasks (min, 0 = none)</span>
          <input type="number" min={0} step={5} value={s.reminder_lead} onChange={(e) => up({ reminder_lead: Math.max(0, Number(e.target.value)) })} />
        </label>
        <label className="set-row">
          <span>Focus timer (min, for untimed tasks)</span>
          <input type="number" min={5} step={5} value={s.focus_min} onChange={(e) => up({ focus_min: Math.max(5, Number(e.target.value)) })} />
        </label>
      </div>

      <Seg name="snap" label="Snap" value={s.snap} options={[[5, '5 min'], [10, '10 min'], [15, '15 min']]} onChange={(v) => up({ snap: v })} />
      <Seg name="push" label="Dropping onto a busy slot" value={s.push_down} options={[[false, 'Overlap side by side'], [true, 'Push later blocks down']]} onChange={(v) => up({ push_down: v })} />
      <Seg name="week" label="Week starts on" value={s.week_start} options={[[1, 'Monday'], [0, 'Sunday']]} onChange={(v) => up({ week_start: v })} />
      <Seg name="clock" label="Clock" value={s.clock24} options={[[true, `24 h (${fmtClock(13 * 60)})`], [false, `12 h (${fmtClock(13 * 60, false)})`]]} onChange={(v) => up({ clock24: v })} />

      <fieldset className="set-row">
        <legend>Reminders</legend>
        <p className="muted">In-app while optimo is open{perm === 'granted' ? ', with system notifications.' : '.'} Push arrives in a later version.</p>
        {perm === 'default' && (
          <button type="button" className="ghost-btn" onClick={() => Notification.requestPermission().then(setPerm)}>
            Allow notifications
          </button>
        )}
      </fieldset>

      <fieldset className="set-row">
        <legend>Organise</legend>
        <div className="set-actions">
          <button type="button" className="ghost-btn" onClick={() => set({ view: 'categories' })}>
            Categories
          </button>
          <button type="button" className="ghost-btn" onClick={() => set({ view: 'icons' })}>
            Icon set
          </button>
          <button type="button" className="ghost-btn" onClick={() => set({ view: 'month' })}>
            Month
          </button>
        </div>
      </fieldset>

      <fieldset className="set-row">
        <legend>Data</legend>
        <div className="set-actions">
          <button type="button" className="ghost-btn" onClick={async () => downloadJson(await exportAll(), `optimo-${todayKey()}.json`)} data-testid="export">
            Export JSON
          </button>
          <button type="button" className="ghost-btn" onClick={() => file.current?.click()}>
            Import JSON
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Import file"
            data-testid="import"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              try {
                const n = await importAll(JSON.parse(await f.text()) as ExportFile)
                notify({ text: `Imported ${n} rows` })
              } catch (err) {
                notify({ text: `Import failed: ${(err as Error).message}` })
              }
              e.target.value = ''
            }}
          />
          <button type="button" className="ghost-btn" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </fieldset>
      <p className="muted mono build">build {document.querySelector('meta[name="build"]')?.getAttribute('content')}</p>
    </section>
  )
}
