import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import type { Task } from '../data/types'
import { fmtClock } from '../lib/time'
import { useUI } from '../state/ui'
import { patchItem, toggleComplete } from '../actions'
import { occurrenceStart } from '../recurrence/exceptions'
import { Icon } from '../icons/Icon'
import './focus.css'

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** One task, full screen: elapsing timer, subtasks, and complete / +5 min / stop (docs/spec.md §2.2). */
export function Focus() {
  const focusId = useUI((s) => s.focusId)
  const set = useUI((s) => s.set)
  const settings = useSettings()
  const [began] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [id, date] = (focusId ?? '').split('@')
  const data = useLiveQuery(async () => {
    const t = id ? await db.tasks.get(id) : undefined
    if (!t) return null
    if (!date) return { task: t, occurrence: undefined }
    const ex = await db.exceptions.get([id, date])
    const o = ex?.task_id ? await db.tasks.get(ex.task_id) : undefined
    const task: Task = o && !o.deleted_at ? { ...o, rrule: t.rrule } : { ...t, start_at: occurrenceStart(t, date), completed_at: null }
    return { task, occurrence: { seriesId: id, date } }
  }, [id, date])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ view: 'day', focusId: null })
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [set])

  const stop = () => set({ view: 'day', focusId: null })
  if (!data) {
    return (
      <section className="focus" aria-label="Focus">
        <p className="muted">Select a block, then press F (or Focus in the editor).</p>
        <button type="button" className="ghost-btn" onClick={stop}>Back to the day</button>
      </section>
    )
  }
  const { task } = data
  const startMs = task.start_at ? new Date(task.start_at).getTime() : began
  // a block that is running right now counts from its start; anything else counts from when focus began
  const running = startMs <= began && began < startMs + task.duration_min * 60_000
  const anchor = running ? startMs : began
  const length = (task.duration_min || settings.focus_min) * 60_000
  const elapsed = now - anchor
  const left = length - elapsed
  const item = { task, occurrence: data.occurrence }

  return (
    <section className="focus" aria-labelledby="focus-h" data-testid="focus">
      <p className="fk mono">FOCUS{task.start_at ? ` · ${fmtClock(new Date(task.start_at).getHours() * 60 + new Date(task.start_at).getMinutes(), settings.clock24)}` : ''}</p>
      <h1 id="focus-h">{task.title || 'Untitled'}</h1>
      <div className="timer mono" role="timer" aria-live="off" data-testid="focus-timer">
        {left >= 0 ? mmss(left) : `+${mmss(-left)}`}
      </div>
      <p className="left mono" data-testid="focus-sub">{left >= 0 ? `left · ${mmss(elapsed)} of ${Math.round(length / 60000)} min` : `over · ${mmss(elapsed)} of ${Math.round(length / 60000)} min`}</p>
      <div className="bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(1, elapsed / length)})` }} />
      </div>
      {task.subtasks.length > 0 && (
        <ul className="fsubs">
          {task.subtasks.map((s, i) => (
            <li key={s.id} className={s.done ? 'done' : ''}>
              <button type="button" className="sub-chip" aria-pressed={s.done} aria-label={`Mark ${s.title} done`} onClick={() => patchItem(item, { subtasks: task.subtasks.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })}>
                {s.done && <Icon name="check" size={14} />}
              </button>
              <span className="sub-t">{s.title}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="factions">
        <button type="button" className="primary" onClick={() => toggleComplete(item).then(stop)} data-testid="focus-complete">
          <Icon name="check" /> Complete
        </button>
        <button type="button" className="ghost-btn" onClick={() => patchItem(item, { duration_min: task.duration_min + 5 }, '+5 min')} data-testid="focus-plus5">
          +5 min
        </button>
        <button type="button" className="ghost-btn" onClick={stop}>
          Stop
        </button>
      </div>
    </section>
  )
}
