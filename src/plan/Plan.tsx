// The Plan tab (arc 3): write what the day should hold → the planner proposes ghost blocks on that day's timeline,
// each with its "why" → accept all, tick some, edit before accepting, or reject. Auto writes the day at once with a
// one-tap Undo. Degrades to a plain notice when the planner isn't connected (no function / tables yet) or offline.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import type { AiBlock, AiPlanMode, Category, SettingsData } from '../data/types'
import { addDays, fmtClock, fmtDur, isoAt, minutesInDay, todayKey } from '../lib/time'
import { useUI } from '../state/ui'
import { Timeline } from '../timeline/Timeline'
import { useItems } from '../timeline/items'
import { useEvents } from '../calendar/events'
import { supabase } from '../sync/remote'
import { PlannerError, propose, type PlannerDown } from './api'
import { acceptPlan, applyPlan, rejectPlan } from './actions'
import { PlanGhosts, type Ghost } from './PlanGhosts'
import './plan.css'

function useOnline() {
  const [on, setOn] = useState(() => navigator.onLine)
  useEffect(() => {
    const up = () => setOn(true)
    const down = () => setOn(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return on
}

/** Session memory: a 404 / not_connected answer keeps the notice up until the app reloads or Mark retries. */
let knownDown: PlannerDown | null = null

type Pick = 'today' | 'tomorrow' | 'date'

export function Plan({ cats, settings }: { cats: Map<string, Category>; settings: SettingsData }) {
  const online = useOnline()
  const [down, setDown] = useState<PlannerDown | null>(() => (supabase() ? knownDown : 'not-connected'))
  // AI-P0-1: the day being planned IS the app's day — the header (title, strip, stats) and the timeline below always
  // agree with what Accept will write to
  const day = useUI((s) => s.date)
  const setUI = useUI((s) => s.set)
  const today = todayKey()
  const pick: Pick = day === today ? 'today' : day === addDays(today, 1) ? 'tomorrow' : 'date'
  const setPick = (p: 'today' | 'tomorrow') => setUI({ date: p === 'today' ? today : addDays(today, 1) })
  // arc 7 slice 9: "Fit with AI" on a day's tray hands its items over as the intent — prefilled, never sent by itself
  const [intent, setIntent] = useState(() => useUI.getState().planIntent ?? '')
  useEffect(() => {
    if (useUI.getState().planIntent !== null) useUI.getState().set({ planIntent: null })
  }, [])
  // Settings → Planning sets the defaults; a choice made here wins for this visit (settings may load after mount)
  const [modeChoice, setMode] = useState<AiPlanMode | null>(null)
  const [researchChoice, setResearch] = useState<boolean | null>(null)
  const mode = modeChoice ?? settings.plan_mode ?? 'propose'
  const research = researchChoice ?? settings.plan_research ?? false
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const plan = useLiveQuery(() => (planId ? db.aiPlans.get(planId) : undefined), [planId])
  // a proposal belongs to its day: switch days and it steps aside (and comes back when that day is shown again)
  const live = plan && plan.status === 'draft' && plan.mode === 'propose' && plan.plan_date === day ? plan : null
  // per-proposal working state (ticks, the block being edited, answers) — keyed by the proposal it belongs to, so a
  // fresh or re-planned proposal starts fully ticked without a reset effect
  const liveKey = live ? `${live.id}|${live.updated_at ?? ''}|${live.version ?? 0}` : ''
  const [work, setWork] = useState<{ key: string; kept: Map<number, AiBlock>; editing: number | null; answers: Record<number, string> } | null>(null)
  const current = work && work.key === liveKey ? work : { key: liveKey, kept: new Map((live?.proposal.blocks ?? []).map((b, i) => [i, b])), editing: null, answers: {} }
  const { kept, editing, answers } = current
  const setKept = (m: Map<number, AiBlock>) => setWork({ ...current, kept: m })
  const setEditing = (i: number | null) => setWork({ ...current, editing: i })
  const setAnswers = (a: Record<number, string>) => setWork({ ...current, answers: a })

  // a fresh proposal is the thing to look at: bring its card into view (below the form on iPhone)
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (live?.id) cardRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [live?.id])

  const planDay = day
  const days = useMemo(() => [planDay], [planDay])
  const itemsByDay = useItems(days)
  const eventsByDay = useEvents(days)
  const items = useMemo(() => itemsByDay?.[planDay] ?? [], [itemsByDay, planDay])
  const events = useMemo(() => eventsByDay[planDay] ?? [], [eventsByDay, planDay])
  const ghosts: Ghost[] = useMemo(() => {
    if (!live) return []
    const busySpans = [
      ...items.map((i) => ({ start: i.start, end: i.end, title: i.task.title })),
      ...events.filter((e) => !e.event.all_day).map((e) => ({ start: e.start, end: e.end, title: e.event.title })),
    ]
    return live.proposal.blocks.map((orig, i) => {
      const b = kept.get(i) ?? orig
      const start = minutesInDay(b.start_at, planDay)
      const end = start + b.duration_min
      const clash = busySpans.find((s) => s.start < end && s.end > start)
      return { i, block: b, start, end, on: kept.has(i), clash: clash?.title ?? null }
    })
  }, [live, kept, items, events, planDay])

  const offline = !online
  const blocked: PlannerDown | null = offline ? 'offline' : down
  const canAsk = !blocked && !busy && intent.trim().length > 0

  async function ask(extra: { plan_id?: string; answers?: { question: string; answer: string }[] } = {}) {
    setBusy(true)
    setError(null)
    try {
      const row = await propose({ date: day, intent: intent.trim(), mode, research, ...extra })
      setPlanId(row.id)
      if (row.plan_date !== useUI.getState().date) setUI({ date: row.plan_date })
      if (row.mode === 'auto') await applyPlan(row)
    } catch (e) {
      const err = e instanceof PlannerError ? e : new PlannerError('Couldn’t reach the planner — try again in a moment.')
      if (err.down === 'not-connected') knownDown = 'not-connected'
      if (err.down) setDown(err.down === 'offline' ? null : err.down)
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function toggle(i: number) {
    if (!live) return
    const next = new Map(kept)
    if (next.has(i)) next.delete(i)
    else next.set(i, live.proposal.blocks[i])
    setKept(next)
  }

  async function accept(all: boolean) {
    if (!live) return
    const decision = all ? new Map(live.proposal.blocks.map((b, i) => [i, kept.get(i) ?? b])) : kept
    if (!decision.size) return
    await acceptPlan(live, { kept: decision })
    setPlanId(null)
  }

  const clock = (min: number) => fmtClock(((min % 1440) + 1440) % 1440, settings.clock24)
  const questions = live?.proposal.questions ?? []

  return (
    <section className="page plan" aria-labelledby="plan-h" data-testid="plan">
      <div className="plan-side">
        <h2 id="plan-h">Plan</h2>
        {blocked ? (
          <div className="plan-down" role="status" data-testid="plan-down">
            <p>{blocked === 'offline' ? 'You’re offline — the planner needs a connection.' : 'Planner isn’t connected yet.'}</p>
            {blocked === 'not-connected' && supabase() && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  knownDown = null
                  setDown(null)
                  setError(null)
                }}
              >
                Try again
              </button>
            )}
          </div>
        ) : null}
        <form
          className="plan-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (canAsk) void ask()
          }}
          aria-disabled={!!blocked}
        >
          <label className="plan-intent">
            <span>What should the day hold?</span>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={4}
              placeholder="Finish the forecast draft before lunch, swim at some point, clear email. I’m wiped after 4."
              disabled={!!blocked}
              data-testid="plan-intent"
            />
          </label>
          <fieldset className="plan-row" aria-labelledby="plan-day-label" disabled={!!blocked}>
            <h3 id="plan-day-label">Day</h3>
            <div className="plan-seg">
              {(['today', 'tomorrow'] as const).map((p) => (
                <button key={p} type="button" aria-pressed={pick === p} onClick={() => setPick(p)} data-testid={`plan-day-${p}`}>
                  {p === 'today' ? 'Today' : 'Tomorrow'}
                </button>
              ))}
              <input
                type="date"
                aria-label="Another day"
                value={day}
                className={pick === 'date' ? 'on' : ''}
                onChange={(e) => {
                  if (!e.target.value) return
                  setUI({ date: e.target.value })
                }}
                data-testid="plan-day-date"
              />
            </div>
          </fieldset>
          <fieldset className="plan-row" aria-labelledby="plan-mode-label" disabled={!!blocked}>
            <h3 id="plan-mode-label">Mode</h3>
            <div className="plan-seg">
              <button type="button" aria-pressed={mode === 'propose'} onClick={() => setMode('propose')} data-testid="plan-mode-propose">
                Propose
              </button>
              <button type="button" aria-pressed={mode === 'auto'} onClick={() => setMode('auto')} data-testid="plan-mode-auto">
                Auto
              </button>
            </div>
          </fieldset>
          <label className="plan-switch">
            <input type="checkbox" role="switch" checked={research} onChange={(e) => setResearch(e.target.checked)} disabled={!!blocked} data-testid="plan-research" />
            <span>Look things up on the web</span>
          </label>
          <button type="submit" className="primary" disabled={!canAsk} data-testid="plan-go">
            {busy ? 'Planning…' : mode === 'auto' ? 'Plan my day' : 'Propose a plan'}
          </button>
          {error && !blocked && (
            <p className="plan-err" role="alert">
              {error}
            </p>
          )}
        </form>

        {live && (
          <div className="plan-card" data-testid="plan-card" aria-live="polite" ref={cardRef}>
            {questions.length > 0 && (
              <div className="plan-qs" data-testid="plan-questions">
                <h3>Before you accept</h3>
                {questions.map((q, i) => (
                  <label key={i} className="plan-q">
                    <span>{q}</span>
                    <input type="text" value={answers[i] ?? ''} onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} data-testid="plan-answer" />
                  </label>
                ))}
                <button
                  type="button"
                  className="ghost-btn"
                  disabled={busy || !Object.values(answers).some((a) => a.trim())}
                  onClick={() => void ask({ plan_id: live.id, answers: questions.map((q, i) => ({ question: q, answer: answers[i] ?? '' })) })}
                  data-testid="plan-replan"
                >
                  Re-plan with answers
                </button>
              </div>
            )}
            {live.proposal.notes && (
              <p className="plan-notes" data-testid="plan-notes">
                {live.proposal.notes}
              </p>
            )}
            <ul className="plan-list" aria-label="Proposed blocks">
              {ghosts.map((g) => (
                <li key={g.i} className={`plan-item ${g.on ? 'on' : ''} ${g.clash ? 'clash' : ''}`} data-testid="plan-block">
                  <button type="button" className="plan-tick" aria-pressed={g.on} aria-label={`Keep ${g.block.title}`} onClick={() => toggle(g.i)} data-testid="plan-tick" />
                  <div className="plan-item-main">
                    {editing === g.i ? (
                      <BlockEdit
                        block={g.block}
                        day={planDay}
                        onDone={(b) => setWork({ ...current, editing: null, kept: b ? new Map(kept).set(g.i, b) : kept })}
                      />
                    ) : (
                      <>
                        <b>{g.block.title}</b>
                        <span className="tnum muted">
                          {clock(g.start)}–{clock(g.end)} · {fmtDur(g.block.duration_min)}
                          {g.block.category_id && cats.get(g.block.category_id) ? ` · ${cats.get(g.block.category_id)!.name}` : ''}
                        </span>
                        {g.block.why && <span className="plan-why">{g.block.why}</span>}
                        {g.clash && <span className="plan-clash" data-testid="plan-clash">Overlaps “{g.clash}”</span>}
                      </>
                    )}
                  </div>
                  {editing !== g.i && (
                    <button type="button" className="ghost-btn plan-edit" onClick={() => setEditing(g.i)} aria-label={`Edit ${g.block.title}`} data-testid="plan-edit">
                      Edit
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {live.research.length > 0 && (
              <div className="plan-sources" data-testid="plan-sources">
                <h3>Sources</h3>
                <ul>
                  {live.research.map((s) => (
                    <li key={s.url}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.title}
                      </a>
                      {s.snippet && <q>{s.snippet}</q>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="plan-actions">
              <button type="button" className="primary" onClick={() => void accept(true)} data-testid="plan-accept-all">
                Accept all
              </button>
              <button type="button" className="ghost-btn" disabled={!kept.size || kept.size === live.proposal.blocks.length} onClick={() => void accept(false)} data-testid="plan-accept-some">
                Accept {kept.size} ticked
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  void rejectPlan(live)
                  setPlanId(null)
                }}
                data-testid="plan-reject"
              >
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="plan-day" aria-label={`Timeline for ${planDay}`}>
        <Timeline day={planDay} items={items} events={events} cats={cats} settings={settings} overlay={(map) => <PlanGhosts ghosts={ghosts} map={map} clock24={settings.clock24} cats={cats} />} />
      </div>
    </section>
  )
}

/** Inline edit of one proposed block: title, start, duration. */
function BlockEdit({ block, day, onDone }: { block: AiBlock; day: string; onDone: (b: AiBlock | null) => void }) {
  const start = minutesInDay(block.start_at, day)
  const [title, setTitle] = useState(block.title)
  const [time, setTime] = useState(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`)
  const [dur, setDur] = useState(block.duration_min)
  return (
    <div className="plan-editor" data-testid="plan-editor">
      <label>
        <span>Title</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="plan-edit-title" />
      </label>
      <label>
        <span>Start</span>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} data-testid="plan-edit-time" />
      </label>
      <label>
        <span>Minutes</span>
        <input type="number" min={5} step={5} value={dur} onChange={(e) => setDur(Math.max(5, Number(e.target.value)))} data-testid="plan-edit-dur" />
      </label>
      <div className="plan-editor-actions">
        <button
          type="button"
          className="primary"
          disabled={!title.trim() || !/^\d{2}:\d{2}$/.test(time)}
          onClick={() => {
            const [h, m] = time.split(':').map(Number)
            onDone({ ...block, title: title.trim(), start_at: isoAt(day, h * 60 + m), duration_min: dur })
          }}
          data-testid="plan-edit-save"
        >
          Done
        </button>
        <button type="button" className="ghost-btn" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </div>
  )
}

