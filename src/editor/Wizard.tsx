import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import * as repo from '../data/repo'
import { durationPresets, type Category, type SettingsData, type Task } from '../data/types'
import { Icon } from '../icons/Icon'
import { dateKey, deviceZone, minutesInDay, nowMinutes, todayKey, zonedParts } from '../lib/time'
import { deleteItem, patchItem, toggleComplete } from '../actions'
import { editOccurrence, occurrenceStart, type Scope } from '../recurrence/exceptions'
import { parseQuickAdd } from '../quickadd/parse'
import { resolveCategory, useKeyboardInset } from '../quickadd/QuickAdd'
import { CATEGORY_OF, suggestIcon, taskIcon } from '../quickadd/suggest'
import { useUI, type Draft, type Wizard as WizardState } from '../state/ui'
import { StepDetails } from './StepDetails'
import { newId } from '../data/ids'
import { PlannerError, suggestSubtasks } from '../plan/api'
import { PaletteSheet } from './PaletteSheet'
import { TimezonePicker } from './TimezonePicker'
import { StepTitle } from './StepTitle'
import { StepWhen } from './StepWhen'
import { buildSuggestions, SUGGESTION_WINDOW_DAYS, type Suggestion } from './suggestions'
import { draftToInput, fmtMeta, type WizardDraft, type WizardStep } from './wizardModel'
import './wizard.css'

/** Titles longer than this many characters set a step smaller in the header field (arc 7 slice 3). */
const LONG_TITLE = 14

/** The prefill (gap / paint / N / parsed command line) → the wizard's working draft. */
export function initialDraft(w: WizardState, uiDate: string, settings: SettingsData): WizardDraft {
  const p: Partial<Draft> = w.draft
  const { title, category_id, start_at, duration_min, all_day, rrule, priority, dtstart: _dtstart, notes, subtasks, reminders, tz, plan_date, someday, estimated: _est, ...extra } = p
  void _est
  void _dtstart
  let date = uiDate
  let start = date === todayKey() ? Math.min(23 * 60 + 45, Math.ceil(nowMinutes() / 15) * 15) : 9 * 60
  if (start_at) {
    date = dateKey(new Date(start_at))
    start = Math.max(0, minutesInDay(start_at, date))
  }
  return {
    title: title ?? '',
    category_id: category_id ?? null,
    date,
    start,
    duration: duration_min ?? settings.default_duration,
    all_day: !!all_day,
    inbox: w.mode === 'inbox',
    plan_date: plan_date ?? null,
    someday: !!someday,
    rrule: rrule ?? null,
    priority: priority ?? 0,
    notes: notes ?? '',
    subtasks: subtasks ?? [],
    reminders: reminders ?? null,
    tz: tz ?? null,
    extra,
  }
}

/** Edit mode: an existing task (or one occurrence of a series) → the working draft, wall-clock in the task's zone. */
export function draftFromTask(task: Task, occ: string | null, uiDate: string, settings: SettingsData): WizardDraft {
  const shown = occ && task.dtstart && !(task as { _override?: boolean })._override ? { ...task, start_at: occurrenceStart(task, occ) } : task
  const tz = shown.tz && !shown.all_day ? shown.tz : null
  const at = shown.start_at ? zonedParts(shown.start_at, tz) : null
  return {
    title: shown.title,
    category_id: shown.category_id,
    date: at?.date ?? shown.plan_date ?? uiDate,
    start: at ? (shown.all_day ? 9 * 60 : at.minutes) : 9 * 60,
    duration: shown.duration_min || settings.default_duration,
    all_day: !!shown.all_day,
    inbox: !shown.start_at,
    plan_date: shown.start_at ? null : (shown.plan_date ?? null),
    someday: !shown.start_at && !!shown.someday,
    rrule: task.rrule,
    priority: shown.priority,
    notes: shown.notes ?? '',
    subtasks: shown.subtasks ?? [],
    reminders: shown.reminders ?? [],
    tz,
    extra: {},
  }
}

/** The task an editing key points at (`id` or `seriesId@date`), occurrences showing their override row. */
export function useEditTarget(editingId: string | null) {
  return useLiveQuery(async () => {
    if (!editingId) return null
    const [id, date] = editingId.split('@')
    const t = await db.tasks.get(id)
    if (!t || t.deleted_at) return null
    if (!date) return { task: t, occ: null as string | null }
    const ex = await db.exceptions.get([id, date])
    const o = ex?.task_id ? await db.tasks.get(ex.task_id) : undefined
    const task = o && !o.deleted_at ? ({ ...o, id: t.id, rrule: t.rrule, dtstart: t.dtstart, _override: true } as Task) : t
    return { task, occ: date }
  }, [editingId])
}

/**
 * Mounted by Planner: the create wizard while `useUI().wizard` is set, and the edit screen (③ of the same sheet, the
 * TaskSheet replacement — slice 7) while `editingId` is set. Portalled into the .app root.
 */
export function Wizard({ settings, cats }: { settings: SettingsData; cats: Category[] }) {
  const wizard = useUI((s) => s.wizard)
  const editingId = useUI((s) => s.editingId)
  const target = useEditTarget(wizard ? null : editingId)
  const root = document.querySelector('.app') ?? document.body
  if (wizard) return createPortal(<WizardSheet wizard={wizard} settings={settings} cats={cats} />, root)
  if (editingId && target) return createPortal(<WizardSheet key={editingId} wizard={{ mode: target.task.start_at ? 'timeline' : 'inbox', draft: {} }} edit={{ ...target, key: editingId }} settings={settings} cats={cats} />, root)
  return null
}

export interface WizardSheetProps {
  wizard: WizardState
  settings: SettingsData
  cats: Category[]
  /** edit mode: the task (or occurrence) being edited — the sheet opens on ③ with Save / Delete / Complete */
  edit?: { task: Task; occ: string | null; key: string }
}

/** ① title + suggestions → ② when → ③ details (stub). Full-screen on iPhone, a centred sheet on desktop. */
export function WizardSheet({ wizard, settings, cats, edit }: WizardSheetProps) {
  const set = useUI((s) => s.set)
  const notify = useUI((s) => s.notify)
  const uiDate = useUI((s) => s.date)
  // arc 7 slice 9: "Pick a time" on a tray chip opens the edit screen on ② (consumed once): the task is drafted onto
  // its day's timeline so ② shows the wheel
  const [startStep] = useState<WizardStep>(() => (edit ? (useUI.getState().editStep ?? 3) : 1))
  useEffect(() => {
    if (useUI.getState().editStep !== null) useUI.getState().set({ editStep: null })
  }, [])
  const [draft, setDraft] = useState<WizardDraft>(() => {
    if (!edit) return initialDraft(wizard, uiDate, settings)
    const d = draftFromTask(edit.task, edit.occ, uiDate, settings)
    if (startStep !== 2 || !d.inbox) return d
    const start = d.date === todayKey() ? Math.min(23 * 60 + 45, Math.ceil(nowMinutes() / 15) * 15) : d.start
    return { ...d, inbox: false, all_day: false, plan_date: null, someday: false, start }
  })
  const [step, setStep] = useState<WizardStep>(startStep)
  const [panel, setPanel] = useState<'tz' | 'palette' | null>(null)
  const [scope, setScope] = useState<Scope>('this')
  // slice 8: AI subtasks (the sparkle on ③)
  const [ai, setAi] = useState<{ busy: boolean; proposals: string[] | null; note: string | null }>({ busy: false, proposals: null, note: null })
  async function suggest() {
    setAi({ busy: true, proposals: null, note: null })
    try {
      const list = await suggestSubtasks({ title: draft.title.trim(), notes: draft.notes, duration_min: draft.inbox ? undefined : draft.duration })
      setAi({ busy: false, proposals: list, note: null })
    } catch (e) {
      setAi({ busy: false, proposals: null, note: e instanceof PlannerError ? e.message : 'Couldn’t reach the planner — try again in a moment.' })
    }
  }
  const [text, setText] = useState(draft.title)
  const [confirm, setConfirm] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  useKeyboardInset(sheetRef)
  const patch = (p: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...p }))
  // edit mode: a duration changed outside the editor (edge resize, Shift+↑/↓) shows here unless edited in the sheet
  const seenDur = useRef(edit?.task.duration_min)
  useEffect(() => {
    if (!edit || edit.task.duration_min === seenDur.current) return
    const prev = seenDur.current
    seenDur.current = edit.task.duration_min
    setDraft((d) => (d.duration === prev ? { ...d, duration: edit.task.duration_min } : d))
  }, [edit])

  // ① live parse of the title field (the command-line grammar)
  const parsed = useMemo(() => (step === 1 && text.trim() ? parseQuickAdd(text) : null), [text, step])
  const parsedCat = parsed ? resolveCategory(parsed, cats) : null
  const catById = (id: string | null) => (id ? (cats.find((c) => c.id === id) ?? null) : null)
  const cat = catById(draft.category_id) ?? (step === 1 ? parsedCat : null)
  const shownTitle = step === 1 ? (parsed?.title ?? text) : draft.title
  const glyph = taskIcon(shownTitle, cat?.icon, settings.iconOverrides)

  // suggestions: the last 60 days of scheduled tasks
  const recent = useLiveQuery(() => {
    const now = Date.now()
    return db.tasks
      .where('start_at')
      .between(new Date(now - SUGGESTION_WINDOW_DAYS * 86_400_000).toISOString(), new Date(now + 1).toISOString(), true, true)
      .toArray()
  }, [])
  const suggestions = useMemo(() => (recent ? buildSuggestions(recent, new Date(), parsed?.title ?? text.trim()) : []), [recent, parsed, text])
  const catOf = (s: Suggestion): Category | null => {
    const own = catById(s.category_id)
    if (own) return own
    const slug = suggestIcon(s.title, settings.iconOverrides)?.category
    return slug ? (cats.find((c) => c.color === CATEGORY_OF[slug]) ?? null) : null
  }

  useEffect(() => {
    if (step === 1) titleRef.current?.focus()
    else bodyRef.current?.focus({ preventScroll: true })
  }, [step])

  const dirty = !edit && (step === 1 ? text : draft.title).trim().length > 0
  const close = () => (edit ? set({ editingId: null, editStep: null }) : set({ wizard: null }))
  const requestClose = () => (dirty ? setConfirm(true) : close())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || panel) return
      e.preventDefault()
      if (confirm) setConfirm(false)
      else if (dirty) setConfirm(true)
      else close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /** ① → ②: what the parser found pre-fills the draft (only what it found). */
  function continueFromTitle() {
    const p = text.trim() ? parseQuickAdd(text) : null
    if (!p?.title) return
    const next: Partial<WizardDraft> = { title: p.title }
    if (p.start) {
      next.date = dateKey(p.start)
      if (p.dateOnly) next.all_day = true
      else {
        next.start = p.start.getHours() * 60 + p.start.getMinutes()
        next.all_day = false
        next.inbox = false // a typed time schedules it, even from the inbox pill
      }
    }
    if (p.duration !== null) next.duration = p.duration
    const c = resolveCategory(p, cats)
    if (c && (p.category || p.icon || !draft.category_id)) next.category_id = c.id
    if (p.rrule) next.rrule = p.rrule
    if (p.priority) next.priority = p.priority
    const inbox = next.inbox ?? draft.inbox
    patch(next)
    setStep(inbox ? 3 : 2)
  }
  function pick(s: Suggestion) {
    setText(s.title)
    // arc 7 slice 3: an inbox-mode pick carries no time — only title, category and length (it stays unscheduled)
    if (draft.inbox) patch({ title: s.title, category_id: catOf(s)?.id ?? draft.category_id, duration: s.duration })
    else patch({ title: s.title, category_id: catOf(s)?.id ?? draft.category_id, start: s.start, duration: s.duration, all_day: false })
    setStep(draft.inbox ? 3 : 2)
  }
  async function create(input: Parameters<typeof repo.createTask>[0] & { start_at: string | null }) {
    if (!input.title) return
    if (edit) return save(input)
    const t = await repo.createTask(input)
    close()
    if (t.start_at && !t.rrule) set({ date: dateKey(new Date(t.start_at)) })
    notify({ text: t.start_at ? `Added “${t.title}”` : `“${t.title}” → inbox`, undo: () => repo.deleteTask(t.id).then(() => undefined) })
  }

  /** Edit mode save — TaskSheet's rules: an occurrence goes through editOccurrence with the chosen scope; a plain task
   *  is patched (undoable); turning repeat on/off makes / unmakes the series. */
  async function save(input: Parameters<typeof repo.createTask>[0] & { start_at: string | null }) {
    if (!edit) return
    const { task, occ } = edit
    const { sort_key: _s, rrule: _r, dtstart: _d, ...fields } = input
    void _s
    void _r
    void _d
    if (occ && task.rrule) await editOccurrence(task.id, occ, fields, scope)
    else {
      const series = draft.rrule && fields.start_at ? { rrule: draft.rrule, dtstart: fields.start_at } : task.rrule ? { rrule: null, dtstart: null } : {}
      await patchItem({ task }, { ...fields, ...series }, 'Saved')
    }
    close()
  }
  const occurrence = edit?.occ ? { seriesId: edit.task.id, date: edit.occ } : undefined

  const titleShown = step === 1 ? text : draft.title
  // the title field grows with its text (rows of its own line height), capped by CSS max-height
  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [titleShown, step])
  const onTitleKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (step === 1) continueFromTitle()
      else if (step === 2) setStep(3)
    }
  }
  const timezone = () => setPanel('tz')
  const stepName = step === 1 ? 'title' : step === 2 ? 'when' : 'details'
  const start = draft.inbox ? null : draft.all_day ? 0 : draft.start

  return (
    <div className="wiz-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && requestClose()}>
      <div
        ref={sheetRef}
        className="wiz"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wiz-h"
        data-testid="wizard"
        data-step={step}
        data-mode={draft.inbox ? 'inbox' : 'timeline'}
        data-date={draft.date}
        data-start={start ?? ''}
        data-duration={draft.duration}
        data-category={draft.category_id ?? cat?.id ?? ''}
      >
        <h1 id="wiz-h" className="sr-only">
          {edit ? `Edit ${draft.title || 'task'}` : `New task, step ${step} of 3: ${stepName}`}
        </h1>
        <div className={`wiz-hd ${step === 3 ? 'wiz-hd-3' : ''} ${cat ? `cat-${cat.color}` : 'cat-accent'}`}>
          <button type="button" className="wiz-x" aria-label="Close" onClick={requestClose} data-testid="wizard-close">
            <Icon name="ui-close" size={22} />
          </button>
          <div className="wiz-hd-row">
            {step === 3 ? (
              // ③ (mockups 06): the task as a capsule on a stub of spine, the palette button at its foot
              <span className="wiz-capsule-wrap">
                <span className="wiz-capsule" style={{ height: Math.min(160, Math.max(56, (draft.inbox ? 30 : draft.duration) * 2)) }} data-testid="wizard-glyph" data-icon={glyph}>
                  <Icon name={glyph} size={36} />
                </span>
                <button type="button" className="wiz-palette" aria-label="Category, icon and priority" onClick={() => setPanel('palette')} data-testid="wizard-palette">
                  <Icon name="ui-palette" size={22} />
                </button>
              </span>
            ) : (
              <span className="wiz-chip-glyph" data-testid="wizard-glyph" data-icon={glyph}>
                <Icon name={glyph} size={36} />
              </span>
            )}
            <div className="wiz-hd-text">
              {step > 1 && (
                <p className="wiz-meta tnum" data-testid="wizard-meta">
                  {fmtMeta(draft, settings.clock24)}
                </p>
              )}
              <label htmlFor="wiz-title" className="sr-only">
                Title
              </label>
              {/* arc 7 slice 3: a one-line field that wraps (2 lines on ①②, 3 on ③) and steps down a size for long
                  titles — "Write the migration plan" reads whole instead of "Write the migratior" */}
              <textarea
                id="wiz-title"
                ref={titleRef}
                className={`wiz-title ${titleShown.length > LONG_TITLE ? 'long' : ''}`}
                rows={1}
                value={titleShown}
                onChange={(e) => {
                  const v = e.target.value.replace(/[\r\n]+/g, ' ')
                  if (step === 1) setText(v)
                  else patch({ title: v })
                }}
                onKeyDown={onTitleKey}
                placeholder="What’s next?"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="next"
                aria-describedby={step === 1 ? 'wiz-parse' : undefined}
                data-testid="wizard-title"
              />
            </div>
            {step > 1 &&
              (edit ? (
                <button
                  type="button"
                  className={`wiz-ring ${edit.task.completed_at ? 'done' : ''}`}
                  aria-label={edit.task.completed_at ? 'Mark not done' : 'Complete'}
                  aria-pressed={!!edit.task.completed_at}
                  onClick={() => void toggleComplete({ task: edit.task, occurrence }).then(close)}
                  data-testid="wizard-complete"
                >
                  {edit.task.completed_at && <Icon name="ui-check" size={14} />}
                </button>
              ) : (
                <span className="wiz-ring" aria-hidden="true" />
              ))}
          </div>
        </div>

        <div ref={bodyRef} className="wiz-scroll" tabIndex={-1}>
          {step === 1 && <StepTitle parsed={parsed} parsedCat={parsedCat} suggestions={suggestions} settings={settings} catOf={catOf} onPick={pick} untimed={draft.inbox} />}
          {step === 2 && (
            <StepWhen
              draft={draft}
              settings={settings}
              presets={durationPresets(settings)}
              onChange={patch}
              onInbox={() => {
                patch({ inbox: true, plan_date: null, someday: false })
                setStep(3)
              }}
              onTimezone={timezone}
            />
          )}
          {step === 3 && (
            <StepDetails
              draft={draft}
              settings={settings}
              cats={cats}
              onChange={patch}
              onEditWhen={draft.inbox && !edit ? undefined : () => setStep(2)}
              onTimeline={() => {
                patch({ inbox: false, all_day: false, someday: false, plan_date: null, date: draft.plan_date ?? draft.date })
                setStep(2)
              }}
              ai={{
                ...ai,
                onSuggest: () => void suggest(),
                onKeep: (titles) => {
                  patch({ subtasks: [...draft.subtasks, ...titles.map((title) => ({ id: newId(), title, done: false }))] })
                  setAi({ busy: false, proposals: null, note: null })
                },
                onDiscard: () => setAi({ busy: false, proposals: null, note: null }),
              }}
              edit={
                edit
                  ? {
                      occurrence: !!(edit.occ && edit.task.rrule),
                      scope,
                      onScope: setScope,
                      onDelete: () => void deleteItem({ task: edit.task, occurrence }).then(close),
                      onFocus: !edit.task.completed_at && edit.task.start_at ? () => set({ focusId: edit.key, view: 'focus', editingId: null }) : undefined,
                    }
                  : undefined
              }
            />
          )}
        </div>

        {/* arc 7 slice 3: the primary action is docked under the scroller on every step — always on screen, above the
            home indicator (safe area) and the on-screen keyboard; Delete and the rest of ③ scroll above it */}
        <div className="wiz-foot wiz-dock">
          {step === 1 && (
            <button type="button" className="wiz-cta" onClick={continueFromTitle} disabled={!(parsed?.title ?? '').trim()} data-testid="wizard-continue">
              Continue
            </button>
          )}
          {step === 2 && (
            <button type="button" className="wiz-cta" onClick={() => setStep(3)} data-testid="wizard-continue">
              Continue
            </button>
          )}
          {step === 3 && (
            <button type="button" className="wiz-cta" onClick={() => void create(draftToInput(draft, settings))} disabled={!draft.title.trim()} data-testid={edit ? 'wizard-save' : 'wizard-create'}>
              {edit ? 'Save' : 'Create Task'}
            </button>
          )}
        </div>

        {panel === 'tz' && <TimezonePicker value={draft.tz} onPick={(tz) => patch({ tz: tz && tz !== deviceZone() ? tz : null, all_day: false })} onClose={() => setPanel(null)} />}
        {panel === 'palette' && (
          <PaletteSheet
            cats={cats}
            categoryId={draft.category_id}
            priority={draft.priority}
            title={draft.title}
            glyph={glyph}
            settings={settings}
            onCategory={(category_id) => patch({ category_id })}
            onPriority={(priority) => patch({ priority })}
            onClose={() => setPanel(null)}
          />
        )}

        {confirm && (
          <div className="wiz-confirm-wrap" role="presentation">
            <div className="wiz-confirm" role="alertdialog" aria-modal="true" aria-labelledby="wiz-confirm-h" data-testid="wizard-discard">
              <h2 id="wiz-confirm-h">Discard this task?</h2>
              <div className="wiz-confirm-btns">
                <button type="button" className="wiz-confirm-keep" onClick={() => setConfirm(false)} autoFocus>
                  Keep editing
                </button>
                <button type="button" className="wiz-confirm-discard" onClick={close}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

