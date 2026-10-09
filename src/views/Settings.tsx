import { useRef } from 'react'
import { useSettings } from '../data/hooks'
import { updateSettings } from '../data/repo'
import { BOOKEND_NAMES, type SettingsData } from '../data/types'
import { downloadJson, exportAll, importAll, type ExportFile } from '../data/export'
import { signOut } from '../auth/session'
import { fmtClock, todayKey } from '../lib/time'
import { useUI } from '../state/ui'
import '../categories/categories.css'
import { CalendarSettings } from '../calendar/CalendarSettings'
import { PushSettings } from '../push/PushSettings'
import { PlanningSettings } from '../plan/PlanningSettings'
import { supabase } from '../sync/remote'

// #12: day bounds are chosen from 15-min steps rendered in the user's clock (a native time field ignores it)
const STEPS = Array.from({ length: 96 }, (_, i) => i * 15)

function TimeSelect({ label, value, clock24, onChange, testid }: { label: string; value: number; clock24: boolean; onChange: (m: number) => void; testid: string }) {
  const opts = STEPS.includes(value) ? STEPS : [...STEPS, value].sort((a, b) => a - b)
  return (
    <label className="set-row">
      <span>{label}</span>
      <select className="mono" value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testid}>
        {opts.map((m) => (
          <option key={m} value={m}>
            {fmtClock(m, clock24)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** A bookend name: saved on blur / Enter (one synced write, not one per keystroke); empty = the default. */
function NameField({ label, value, fallback, onChange, testid }: { label: string; value?: string; fallback: string; onChange: (v: string) => void; testid: string }) {
  return (
    <label className="set-row">
      <span>{label}</span>
      <input
        key={value ?? ''}
        defaultValue={value ?? ''}
        placeholder={fallback}
        maxLength={40}
        onBlur={(e) => e.target.value.trim() !== (value ?? '') && onChange(e.target.value.trim())}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        data-testid={testid}
      />
    </label>
  )
}

// #20: an <h3> + aria-labelledby, not a native <legend> — WebKit on iOS straddles a legend across the card edge
// (float:left;width:100% doesn't fully override the UA's special legend layout box on every mobile engine).
function Seg<T extends string | number | boolean>({ label, value, options, onChange, name }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void; name: string }) {
  const labelId = `set-${name}-label`
  return (
    <fieldset className="set-row seg" aria-labelledby={labelId} data-testid={`set-${name}`}>
      <h3 id={labelId}>{label}</h3>
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
  const up = (p: Partial<SettingsData>) => void updateSettings(p)

  return (
    <section className="page settings" aria-labelledby="set-h" tabIndex={-1}>
      <h2 id="set-h">Settings</h2>
      <p className="muted">Synced to every device signed in to this account.</p>

      <Seg name="theme" label="Theme" value={s.theme} options={[['system', 'System'], ['dark', 'Dark'], ['light', 'Light']]} onChange={(v) => up({ theme: v })} />

      {/* arc 6: the day's bookends — the two anchor rows at the top and bottom of the spine */}
      <fieldset className="set-row set-day" id="set-day" aria-labelledby="set-day-label" data-testid="set-day">
        <h3 id="set-day-label">Day</h3>
        <div className="set-grid">
          <TimeSelect label="Day starts" value={s.day_start} clock24={s.clock24} onChange={(m) => up({ day_start: m })} testid="set-day-start" />
          <NameField label="Morning bookend" value={s.day_start_name} fallback={BOOKEND_NAMES.start} onChange={(v) => up({ day_start_name: v })} testid="set-day-start-name" />
          <TimeSelect label="Day ends" value={s.day_end} clock24={s.clock24} onChange={(m) => up({ day_end: m })} testid="set-day-end" />
          <NameField label="Evening bookend" value={s.day_end_name} fallback={BOOKEND_NAMES.end} onChange={(v) => up({ day_end_name: v })} testid="set-day-end-name" />
        </div>
      </fieldset>

      <div className="set-grid">
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

      {supabase() && <CalendarSettings />}

      <PushSettings />

      <PlanningSettings s={s} />

      <fieldset className="set-row" aria-labelledby="set-organise-label">
        <h3 id="set-organise-label">Organise</h3>
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

      <fieldset className="set-row" aria-labelledby="set-data-label">
        <h3 id="set-data-label">Data</h3>
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
            Sign out of the Family Wing
          </button>
        </div>
      </fieldset>
      <p className="muted mono build">build {document.querySelector('meta[name="build"]')?.getAttribute('content')}</p>
    </section>
  )
}
