import { useRef, useState } from 'react'
import type { SettingsData } from '../data/types'
import { Icon } from '../icons/Icon'
import { addDays, fromKey, todayKey } from '../lib/time'
import { DurationSheet } from './DurationSheet'
import { MoreMenu } from './MoreMenu'
import { TimeWheel } from './TimeWheel'
import { presetShort, type WizardDraft } from './wizardModel'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** `Fri, Oct 9, 2026` */
export function fmtLongDate(key: string): string {
  const d = fromKey(key)
  return `${WD[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}
/** `Today` · `Tomorrow` · `Yesterday` · `` */
export function relDay(key: string): string {
  const t = todayKey()
  if (key === t) return 'Today'
  if (key === addDays(t, 1)) return 'Tomorrow'
  if (key === addDays(t, -1)) return 'Yesterday'
  return ''
}
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Opens a visually hidden native picker (date / time); falls back to focus + click where showPicker is missing. */
function openPicker(el: HTMLInputElement | null) {
  if (!el) return
  try {
    if (typeof el.showPicker === 'function') return el.showPicker()
  } catch {
    /* not allowed here — fall through */
  }
  el.focus()
  el.click()
}

/** The date row card — shared with ③. */
export function DateRow({ date, onDate, testid = 'wizard-date' }: { date: string; onDate?: (key: string) => void; testid?: string }) {
  const input = useRef<HTMLInputElement>(null)
  const rel = relDay(date)
  return (
    <div className="wiz-card wiz-row-card">
      <button type="button" className="wiz-row" onClick={() => openPicker(input.current)} disabled={!onDate} data-testid={testid} aria-label={`Date, ${fmtLongDate(date)}${rel ? `, ${rel}` : ''}`}>
        <Icon name="ui-calendar" size={24} className="wiz-row-glyph" />
        <span className="wiz-row-text">{fmtLongDate(date)}</span>
        <span className="wiz-row-end">
          {rel}
          {onDate && <Icon name="ui-chevron-right" size={16} />}
        </span>
      </button>
      {onDate && (
        <input
          ref={input}
          type="date"
          className="wiz-native"
          tabIndex={-1}
          aria-hidden="true"
          value={date}
          onChange={(e) => e.target.value && onDate(e.target.value)}
          data-testid="wizard-date-input"
        />
      )}
    </div>
  )
}

export interface StepWhenProps {
  draft: WizardDraft
  settings: SettingsData
  presets: number[]
  onChange: (patch: Partial<WizardDraft>) => void
  onContinue: () => void
  /** Add to Inbox: unscheduled, straight to ③ */
  onInbox: () => void
  /** Set Timezone — slice 7 opens the picker; until then the wizard toasts */
  onTimezone: () => void
}

/** ② When (mockups 02 / 05 / 03): date row, Time (••• menu + wheel), Duration (••• sheet + presets row), Continue. */
export function StepWhen({ draft, settings, presets, onChange, onContinue, onInbox, onTimezone }: StepWhenProps) {
  const [menu, setMenu] = useState(false)
  const [sheet, setSheet] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)
  const timeInput = useRef<HTMLInputElement>(null)
  const moreBtn = useRef<HTMLButtonElement>(null)
  const durBtn = useRef<HTMLButtonElement>(null)
  return (
    <div className="wiz-body wiz-step2">
      <DateRow date={draft.date} onDate={(date) => onChange({ date })} />
      {/* Change Day + Time Picker open these (the date row has its own) */}
      <input ref={dateInput} type="date" className="wiz-native" tabIndex={-1} aria-hidden="true" value={draft.date} onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
      <input
        ref={timeInput}
        type="time"
        className="wiz-native"
        tabIndex={-1}
        aria-hidden="true"
        value={hhmm(draft.start)}
        onChange={(e) => {
          const [h, m] = e.target.value.split(':').map(Number)
          if (Number.isFinite(h) && Number.isFinite(m)) onChange({ start: h * 60 + m, all_day: false })
        }}
        data-testid="wizard-time-input"
      />

      <section className="wiz-sec" aria-labelledby="wiz-time-h">
        <div className="wiz-sec-hd">
          <h2 id="wiz-time-h">Time</h2>
          <button ref={moreBtn} type="button" className="wiz-more" aria-label="More time options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(true)} data-testid="time-more">
            <Icon name="ui-more" size={20} />
          </button>
          {menu && (
            <MoreMenu
              label="Time options"
              testid="time-menu"
              onClose={() => {
                setMenu(false)
                moreBtn.current?.focus()
              }}
              groups={[
                [
                  { id: 'day', label: 'Change Day', icon: 'ui-calendar', run: () => openPicker(dateInput.current) },
                  { id: 'timezone', label: 'Set Timezone', icon: 'ui-globe', run: onTimezone },
                ],
                [
                  draft.all_day
                    ? { id: 'allday', label: 'Change to Timed', icon: 'ui-clock', run: () => onChange({ all_day: false }) }
                    : { id: 'allday', label: 'Change to All-Day', icon: 'ui-timer', run: () => onChange({ all_day: true }) },
                  { id: 'inbox', label: 'Add to Inbox', icon: 'ui-inbox', run: onInbox },
                ],
                [{ id: 'picker', label: 'Time Picker', icon: 'ui-clock', chevron: true, run: () => openPicker(timeInput.current) }],
              ]}
            />
          )}
        </div>
        {draft.all_day ? (
          <div className="wiz-card wiz-row-card">
            <div className="wiz-row" data-testid="wizard-allday">
              <Icon name="ui-timer" size={24} className="wiz-row-glyph" />
              <span className="wiz-row-text">All day</span>
            </div>
          </div>
        ) : (
          <TimeWheel start={draft.start} duration={draft.duration} clock24={settings.clock24} onChange={(start) => onChange({ start })} />
        )}
      </section>

      <section className="wiz-sec" aria-labelledby="wiz-dur-h">
        <div className="wiz-sec-hd">
          <h2 id="wiz-dur-h">Duration</h2>
          <button ref={durBtn} type="button" className="wiz-more" aria-label="More duration options" aria-haspopup="dialog" aria-expanded={sheet} onClick={() => setSheet(true)} data-testid="duration-more">
            <Icon name="ui-more" size={20} />
          </button>
        </div>
        <div className="dur-row" role="group" aria-labelledby="wiz-dur-h">
          <div className="dur-row-in">
            {presets.map((p) => (
              <button key={p} type="button" className="dur-q tnum" aria-pressed={draft.duration === p} onClick={() => onChange({ duration: p })} data-testid="duration-chip" data-min={p}>
                {presetShort(p)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="wiz-foot">
        <button type="button" className="wiz-cta" onClick={onContinue} data-testid="wizard-continue">
          Continue
        </button>
      </div>

      {sheet && (
        <DurationSheet
          value={draft.duration}
          presets={presets}
          onChange={(duration) => onChange({ duration })}
          onClose={() => {
            setSheet(false)
            durBtn.current?.focus()
          }}
        />
      )}
    </div>
  )
}
