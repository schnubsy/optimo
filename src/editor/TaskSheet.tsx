import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import * as repo from '../data/repo'
import { useCategories, useSettings } from '../data/hooks'
import type { Priority, Subtask, Task } from '../data/types'
import { newId } from '../data/ids'
import { dateKey, fmtDur, fromKey, isoAt, minutesInDay } from '../lib/time'
import { useUI } from '../state/ui'
import { deleteItem, patchItem, toggleComplete } from '../actions'
import { editOccurrence, type Scope } from '../recurrence/exceptions'
import { REPEAT_OPTIONS, repeatLabel, repeatToRule, ruleToRepeat } from '../recurrence/rules'
import { Icon } from '../icons/Icon'
import './sheet.css'

const PRIORITIES: { v: Priority; label: string }[] = [
  { v: 0, label: 'None' },
  { v: 1, label: 'Low' },
  { v: 2, label: 'Med' },
  { v: 3, label: 'High' },
]
const REMINDER_CHOICES = [0, 5, 10, 15, 30, 60]

interface Form {
  title: string
  notes: string
  category_id: string | null
  priority: Priority
  scheduled: boolean
  date: string
  time: string
  duration_min: number
  all_day: boolean
  subtasks: Subtask[]
  reminders: number[]
  repeat: string
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

function toForm(t: Partial<Task> & { start_at: string | null; duration_min: number }, day: string): Form {
  const d = t.start_at ? dateKey(new Date(t.start_at)) : day
  const min = t.start_at ? minutesInDay(t.start_at, d) : 9 * 60
  return {
    title: t.title ?? '',
    notes: t.notes ?? '',
    category_id: t.category_id ?? null,
    priority: (t.priority ?? 0) as Priority,
    scheduled: !!t.start_at,
    date: d,
    time: hhmm(min),
    duration_min: t.duration_min,
    all_day: !!t.all_day,
    subtasks: t.subtasks ?? [],
    reminders: t.reminders ?? [],
    repeat: ruleToRepeat(t.rrule ?? null),
  }
}

function fromForm(f: Form): repo.TaskInput {
  const [h, m] = f.time.split(':').map(Number)
  return {
    title: f.title.trim(),
    notes: f.notes,
    category_id: f.category_id,
    priority: f.priority,
    start_at: f.scheduled ? isoAt(f.date, f.all_day ? 0 : h * 60 + m) : null,
    duration_min: Math.max(0, Math.round(f.duration_min)),
    all_day: f.scheduled && f.all_day,
    subtasks: f.subtasks.filter((s) => s.title.trim()),
    reminders: f.reminders,
  }
}

/** Parse an editing key: plain task id, or `<seriesId>@<date>` for one occurrence of a series. */
function parseKey(key: string) {
  const [id, date] = key.split('@')
  return { id, date: date ?? null }
}

export function TaskSheet() {
  const editingId = useUI((s) => s.editingId)
  const draft = useUI((s) => s.draft)
  const loaded = useLiveQuery(async () => (editingId ? ((await db.tasks.get(parseKey(editingId).id)) ?? null) : null), [editingId])
  if (draft) return <SheetForm key={`draft:${draft.start_at}`} task={null} occ={null} />
  if (!editingId || !loaded) return null
  return <SheetForm key={editingId} task={loaded} occ={parseKey(editingId).date} />
}

function SheetForm({ task, occ }: { task: Task | null; occ: string | null }) {
  const draft = useUI((s) => s.draft)
  const editingId = useUI((s) => s.editingId)
  const day = useUI((s) => s.date)
  const set = useUI((s) => s.set)
  const settings = useSettings()
  const cats = useCategories()
  const [form, setForm] = useState<Form>(() => {
    if (!task) return toForm({ ...draft, start_at: draft?.start_at ?? null, duration_min: draft?.duration_min ?? settings.default_duration }, day)
    // an occurrence edits that day's instance of the series
    const shown = occ && task.dtstart ? { ...task, start_at: isoAt(occ, minutesInDay(task.dtstart, dateKey(new Date(task.dtstart)))) } : task
    return toForm(shown, day)
  })
  const [scope, setScope] = useState<Scope>('this')
  const [newSub, setNewSub] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (!task) titleRef.current?.focus()
    else formRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ editingId: null, draft: null })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [task, set])

  const close = () => set({ editingId: null, draft: null })
  const up = (p: Partial<Form>) => setForm({ ...form, ...p })

  async function save(e?: FormEvent) {
    e?.preventDefault()
    if (!form) return
    const input = fromForm(form)
    const rrule = form.scheduled ? repeatToRule(form.repeat, fromKey(form.date)) : null
    if (!task) {
      if (!input.title) return close()
      await repo.createTask({ ...input, sort_key: Date.now(), ...(rrule ? { rrule, dtstart: input.start_at } : {}) })
    } else if (occ && task.rrule) {
      await editOccurrence(task, occ, input, scope)
    } else {
      const series = rrule ? { rrule, dtstart: input.start_at } : task.rrule ? { rrule: null, dtstart: null } : {}
      await patchItem({ task }, { ...input, ...series }, 'Saved')
    }
    close()
  }

  const done = !!task?.completed_at
  return (
    <div className="sheet-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <form ref={formRef} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h" onSubmit={save}>
        <header className="sheet-hd">
          <h2 id="sheet-h">{task ? (occ ? 'Edit occurrence' : 'Edit task') : 'New task'}</h2>
          <button type="button" className="ghost-btn" onClick={close} aria-label="Close">
            Esc
          </button>
        </header>

        <label className="fld">
          <span>Title</span>
          <input ref={titleRef} value={form.title} onChange={(e) => up({ title: e.target.value })} placeholder="What needs doing" data-testid="sheet-title" />
        </label>

        <div className="row2">
          <label className="fld">
            <span>Category</span>
            <select value={form.category_id ?? ''} onChange={(e) => up({ category_id: e.target.value || null })}>
              <option value="">None</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="fld seg">
            <legend>Priority</legend>
            <div>
              {PRIORITIES.map((p) => (
                <button type="button" key={p.v} aria-pressed={form.priority === p.v} onClick={() => up({ priority: p.v })}>
                  {p.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="chkrow">
          <input type="checkbox" checked={form.scheduled} onChange={(e) => up({ scheduled: e.target.checked })} />
          <span>On the timeline (off = inbox)</span>
        </label>
        {form.scheduled && (
          <>
            <div className="row3">
              <label className="fld">
                <span>Date</span>
                <input type="date" value={form.date} onChange={(e) => up({ date: e.target.value })} disabled={!!occ} />
              </label>
              <label className="fld">
                <span>Start</span>
                <input type="time" step={300} value={form.time} onChange={(e) => up({ time: e.target.value })} disabled={form.all_day} data-testid="sheet-time" />
              </label>
              <label className="fld">
                <span>Duration (min)</span>
                <input type="number" min={0} step={settings.snap} value={form.duration_min} onChange={(e) => up({ duration_min: Number(e.target.value) })} data-testid="sheet-duration" />
              </label>
            </div>
            <div className="row2">
              <label className="chkrow">
                <input type="checkbox" checked={form.all_day} onChange={(e) => up({ all_day: e.target.checked })} />
                <span>All day</span>
              </label>
              <label className="fld">
                <span>Repeat</span>
                <select value={form.repeat} onChange={(e) => up({ repeat: e.target.value })} disabled={!!occ} data-testid="sheet-repeat">
                  {REPEAT_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {repeatLabel(o)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}

        <fieldset className="fld">
          <legend>Subtasks</legend>
          <ul className="subs">
            {form.subtasks.map((s, i) => (
              <li key={s.id}>
                <label className="chkrow">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => up({ subtasks: form.subtasks.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)) })}
                  />
                  <span>{s.title}</span>
                </label>
                <button type="button" className="ghost-btn" aria-label={`Remove ${s.title}`} onClick={() => up({ subtasks: form.subtasks.filter((_, j) => j !== i) })}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="addsub">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Add a subtask"
              aria-label="New subtask"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (newSub.trim()) up({ subtasks: [...form.subtasks, { id: newId(), title: newSub.trim(), done: false }] })
                  setNewSub('')
                }
              }}
            />
          </div>
        </fieldset>

        <fieldset className="fld">
          <legend>Reminders (before start, in-app)</legend>
          <div className="chips">
            {REMINDER_CHOICES.map((m) => (
              <button
                type="button"
                key={m}
                aria-pressed={form.reminders.includes(m)}
                onClick={() => up({ reminders: form.reminders.includes(m) ? form.reminders.filter((x) => x !== m) : [...form.reminders, m].sort((a, b) => a - b) })}
              >
                {m === 0 ? 'At start' : fmtDur(m)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="fld">
          <span>Notes</span>
          <textarea rows={3} value={form.notes} onChange={(e) => up({ notes: e.target.value })} />
        </label>

        {occ && task?.rrule && (
          <fieldset className="fld seg">
            <legend>Apply to</legend>
            <div>
              {(['this', 'following', 'all'] as Scope[]).map((s) => (
                <button type="button" key={s} aria-pressed={scope === s} onClick={() => setScope(s)}>
                  {s === 'this' ? 'This' : s === 'following' ? 'This & following' : 'All'}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <footer className="sheet-ft">
          {task && (
            <>
              <button type="button" className="ghost-btn" onClick={() => deleteItem({ task, occurrence: occ ? { seriesId: task.id, date: occ } : undefined }).then(close)}>
                Delete
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => toggleComplete({ task, occurrence: occ ? { seriesId: task.id, date: occ } : undefined }).then(close)}
              >
                <Icon name="check" /> {done ? 'Not done' : 'Complete'}
              </button>
              {!done && task.start_at && (
                <button type="button" className="ghost-btn" onClick={() => set({ focusId: editingId, view: 'focus', editingId: null })}>
                  Focus
                </button>
              )}
            </>
          )}
          <button type="submit" className="primary" data-testid="sheet-save">
            {task ? 'Save' : 'Add'}
          </button>
        </footer>
      </form>
    </div>
  )
}
