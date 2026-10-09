import { useRef, useState } from 'react'
import { newId } from '../data/ids'
import type { Category, SettingsData } from '../data/types'
import { Icon } from '../icons/Icon'
import { deviceZone, zoneCity } from '../lib/time'
import type { Scope } from '../recurrence/exceptions'
import { repeatLabel, repeatToRule, ruleToRepeat } from '../recurrence/rules'
import { addDays, fromKey, shortDay, todayKey } from '../lib/time'
import { AlertSheet, alertSummary } from './AlertSheet'
import { RepeatSheet } from './RepeatSheet'
import { fmtLongDate, relDay } from './StepWhen'
import { durLong, fmtRange, type WizardDraft } from './wizardModel'

export interface StepDetailsProps {
  draft: WizardDraft
  settings: SettingsData
  cats: Category[]
  onChange: (patch: Partial<WizardDraft>) => void
  /** back to ② (date / time rows) — absent in inbox mode */
  onEditWhen?: () => void
  /** arc 7 slice 6: the place control's Timeline — schedule it (the wizard drafts it onto the timeline and opens ②) */
  onTimeline?: () => void
  /** edit mode (the screen that replaced TaskSheet) */
  edit?: {
    /** one occurrence of a series: the rule is fixed; scope picks which occurrences a save changes */
    occurrence: boolean
    scope: Scope
    onScope: (s: Scope) => void
    onDelete: () => void
    onFocus?: () => void
  }
  /** slice 8: the sparkle button — proposes subtasks through plan-day */
  ai?: { busy: boolean; onSuggest: () => void; proposals: string[] | null; note: string | null; onKeep: (titles: string[]) => void; onDiscard: () => void }
}

/**
 * ③ Details — also the edit screen (mockups 06): the rows card (date · time → ② · alerts), Repeat, the subtasks card with
 * the AI sparkle, notes; in edit mode Delete under the notes (Complete sits on the header ring). Create Task / Save is
 * the wizard's docked footer (arc 7 slice 3), so it never scrolls out of view.
 */
export type PlaceId = 'inbox' | 'today' | 'tomorrow' | 'day' | 'someday' | 'timeline'

/** The draft's place, as the ③ control shows it. */
export function draftPlace(d: Pick<WizardDraft, 'inbox' | 'plan_date' | 'someday'>, today: string): PlaceId {
  if (!d.inbox) return 'timeline'
  if (d.someday) return 'someday'
  if (!d.plan_date) return 'inbox'
  return d.plan_date === today ? 'today' : d.plan_date === addDays(today, 1) ? 'tomorrow' : 'day'
}

/**
 * arc 7 slice 6 — ③'s one-tap place control (replaces the inert "Inbox" row): Inbox · Today · Tomorrow · Pick day ·
 * Someday · Timeline. The first five keep the task untimed (start_at null) and set its day / Someday; Timeline drafts it
 * onto the timeline and opens ② to pick the time. The current place reads pressed.
 */
function PlaceControl({ draft, onChange, onTimeline }: { draft: WizardDraft; onChange: (p: Partial<WizardDraft>) => void; onTimeline?: () => void }) {
  const today = todayKey()
  const place = draftPlace(draft, today)
  const dateRef = useRef<HTMLInputElement>(null)
  const untimed = (plan_date: string | null, someday = false) => onChange({ inbox: true, all_day: false, plan_date, someday })
  function openPicker() {
    const el = dateRef.current
    if (!el) return
    try {
      el.showPicker()
    } catch {
      el.focus()
    }
  }
  const chip = (id: PlaceId, label: string, run: () => void) => (
    <button type="button" className="det-place-chip" aria-pressed={place === id} onClick={run} data-testid={`place-${id}`}>
      {label}
    </button>
  )
  return (
    <div className="det-place" role="group" aria-label="Where it goes" data-testid="details-place" data-place={place}>
      {chip('inbox', 'Inbox', () => untimed(null))}
      {chip('today', 'Today', () => untimed(today))}
      {chip('tomorrow', 'Tomorrow', () => untimed(addDays(today, 1)))}
      <span className="det-place-pick">
        <button type="button" className="det-place-chip" aria-pressed={place === 'day'} onClick={openPicker} data-testid="place-day">
          {place === 'day' && draft.plan_date ? shortDay(fromKey(draft.plan_date)) : 'Pick day'}
        </button>
        <input
          ref={dateRef}
          type="date"
          className="det-place-date"
          tabIndex={-1}
          aria-hidden="true"
          value={draft.plan_date ?? ''}
          onChange={(e) => e.target.value && untimed(e.target.value)}
          data-testid="place-date"
        />
      </span>
      {chip('someday', 'Someday', () => untimed(null, true))}
      {chip('timeline', 'Timeline', () => onTimeline?.())}
    </div>
  )
}

export function StepDetails({ draft, settings, onChange, onEditWhen, onTimeline, edit, ai }: StepDetailsProps) {
  const [sheet, setSheet] = useState<'alerts' | 'repeat' | null>(null)
  const [dropped, setDropped] = useState<Set<number>>(new Set())
  const [newSub, setNewSub] = useState('')
  const timed = !draft.inbox && !draft.all_day
  const leads = draft.reminders ?? (timed && settings.reminder_lead ? [settings.reminder_lead] : [])
  const [alertL, alertR] = alertSummary(leads)
  const repeat = ruleToRepeat(draft.rrule)
  const rel = relDay(draft.date)
  const zoned = timed && draft.tz && draft.tz !== deviceZone()
  const addSub = () => {
    const t = newSub.trim()
    if (t) onChange({ subtasks: [...draft.subtasks, { id: newId(), title: t, done: false }] })
    setNewSub('')
  }
  return (
    <div className="wiz-body wiz-step3">
      {/* a series occurrence stays on the timeline — no place to move it to */}
      {!edit?.occurrence && <PlaceControl draft={draft} onChange={onChange} onTimeline={onTimeline} />}
      {!draft.inbox ? (
        <div className="wiz-card wiz-rows det-rows">
          <button type="button" className="wiz-row" onClick={onEditWhen} disabled={!onEditWhen} data-testid="details-date" aria-label={`Date, ${fmtLongDate(draft.date)}${rel ? `, ${rel}` : ''}. Change`}>
            <Icon name="ui-calendar" size={24} className="wiz-row-glyph" />
            <span className="wiz-row-text">{fmtLongDate(draft.date)}</span>
            <span className="wiz-row-end">
              {rel}
              <Icon name="ui-chevron-right" size={16} />
            </span>
          </button>
          <button type="button" className={`wiz-row ${zoned ? 'has-tz' : ''}`} onClick={onEditWhen} disabled={!onEditWhen} data-testid="details-time">
            <Icon name="ui-clock" size={24} className="wiz-row-glyph" />
            <span className="wiz-row-text tnum">
              {draft.all_day ? 'All day' : fmtRange(draft.start, draft.duration, settings.clock24)}
              {zoned && (
                <span className="det-tz" data-testid="details-tz">
                  <Icon name="ui-globe" size={14} /> {zoneCity(draft.tz!)}
                </span>
              )}
            </span>
            <span className="wiz-row-end">
              {durLong(draft.duration)}
              <Icon name="ui-chevron-right" size={16} />
            </span>
          </button>
          <button type="button" className="wiz-row" onClick={() => setSheet('alerts')} data-testid="details-alerts">
            <Icon name={leads.length ? 'rest-alarm' : 'ui-bell-off'} size={24} className="wiz-row-glyph" />
            <span className="wiz-row-text">{alertL}</span>
            <span className="wiz-row-end">
              {alertR}
              <Icon name="ui-chevron-right" size={16} />
            </span>
          </button>
        </div>
      ) : (
        <div className="wiz-card wiz-row-card">
          <div className="wiz-row" data-testid="details-inbox">
            <Icon name={draft.someday ? 'ui-inbox' : draft.plan_date ? 'ui-calendar' : 'ui-inbox'} size={24} className="wiz-row-glyph" />
            <span className="wiz-row-text">{draft.someday ? 'Someday' : draft.plan_date ? `${fmtLongDate(draft.plan_date)} · no time yet` : 'Inbox'}</span>
            <span className="wiz-row-end">{durLong(draft.duration)}</span>
          </div>
        </div>
      )}

      {!draft.inbox && (
        <button type="button" className="det-repeat" onClick={() => setSheet('repeat')} aria-haspopup="dialog" data-testid="details-repeat">
          <Icon name="ui-repeat" size={22} />
          {repeat === 'none' ? 'Repeat' : repeatLabel(repeat)}
        </button>
      )}

      <div className="wiz-card det-card">
        <ul className="det-subs" aria-label="Subtasks">
          {draft.subtasks.map((s, i) => (
            <li key={s.id} className={`det-sub ${s.done ? 'done' : ''}`} data-testid="subtask">
              <button
                type="button"
                className="det-box"
                aria-pressed={s.done}
                aria-label={`Mark ${s.title} done`}
                onClick={() => onChange({ subtasks: draft.subtasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}
              >
                {s.done && <Icon name="ui-check" size={14} />}
              </button>
              <span className="det-sub-t">{s.title}</span>
              <button type="button" className="det-sub-x" aria-label={`Remove ${s.title}`} onClick={() => onChange({ subtasks: draft.subtasks.filter((_, j) => j !== i) })}>
                <Icon name="ui-close" size={14} />
              </button>
            </li>
          ))}
          <li className="det-sub det-add">
            <span className="det-box" aria-hidden="true" />
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addSub()
                }
              }}
              onBlur={addSub}
              placeholder="Add Subtask"
              aria-label="New subtask"
              data-testid="subtask-add"
            />
            {ai && (
              <button type="button" className="det-ai" aria-label="Suggest subtasks" aria-busy={ai.busy} disabled={ai.busy || !draft.title.trim()} onClick={ai.onSuggest} data-testid="subtask-ai">
                {ai.busy ? <i className="det-spin" aria-hidden="true" /> : <Icon name="ui-ai" size={24} />}
              </button>
            )}
          </li>
        </ul>
        {ai?.note && (
          <p className="det-ai-note" role="status" data-testid="subtask-ai-note">
            {ai.note}
          </p>
        )}
        {ai?.proposals && (
          <div className="det-props" role="group" aria-label="Suggested subtasks" data-testid="subtask-proposals">
            <ul className="det-subs">
              {ai.proposals.map((t, i) => (
                <li key={`${i}:${t}`} className={`det-sub det-prop ${dropped.has(i) ? 'off' : ''}`} data-testid="subtask-proposal">
                  <button
                    type="button"
                    className="det-box"
                    aria-pressed={!dropped.has(i)}
                    aria-label={`Keep ${t}`}
                    onClick={() => setDropped((d) => {
                      const n = new Set(d)
                      if (n.has(i)) n.delete(i)
                      else n.add(i)
                      return n
                    })}
                  >
                    {!dropped.has(i) && <Icon name="ui-check" size={14} />}
                  </button>
                  <span className="det-sub-t">{t}</span>
                </li>
              ))}
            </ul>
            <div className="det-props-btns">
              <button type="button" className="det-discard" onClick={() => (setDropped(new Set()), ai.onDiscard())} data-testid="subtask-discard">
                Discard
              </button>
              <button type="button" className="det-keep" onClick={() => (ai.onKeep(ai.proposals!.filter((_, i) => !dropped.has(i))), setDropped(new Set()))} data-testid="subtask-keep">
                Keep all
              </button>
            </div>
          </div>
        )}
        <label className="det-notes">
          <span className="sr-only">Notes</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="Add notes, links or a number to call…" data-testid="details-notes" />
        </label>
      </div>

      {edit && (
        <div className="det-edit-actions">
          <button type="button" className="det-delete" onClick={edit.onDelete} data-testid="details-delete">
            Delete
          </button>
          {edit.onFocus && (
            <button type="button" className="det-focus" onClick={edit.onFocus} data-testid="details-focus">
              Focus
            </button>
          )}
        </div>
      )}

      {sheet === 'alerts' && <AlertSheet value={leads} onChange={(r) => onChange({ reminders: r })} onClose={() => setSheet(null)} />}
      {sheet === 'repeat' && (
        <RepeatSheet
          repeat={repeat}
          onRepeat={edit?.occurrence ? undefined : (r) => onChange({ rrule: repeatToRule(r, fromKey(draft.date)) })}
          scope={edit?.occurrence ? edit.scope : undefined}
          onScope={edit?.occurrence ? edit.onScope : undefined}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
