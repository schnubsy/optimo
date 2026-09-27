import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../data/db'
import { useSettings } from '../data/hooks'
import { addDays, fmtClock, fmtDur, nowMinutes, shortDay, fromKey, todayKey } from '../lib/time'
import { loadItems } from '../timeline/items'
import { freeRows, snap } from '../timeline/layout'
import { useUI } from '../state/ui'
import { schedule } from '../actions'

/** Place: free slots from the day's real free rows that fit the estimate, earliest first (directions.md #1). */
export function PlacePicker() {
  const placeId = useUI((s) => s.placeId)
  const date = useUI((s) => s.date)
  const set = useUI((s) => s.set)
  const settings = useSettings()
  const task = useLiveQuery(() => (placeId ? db.tasks.get(placeId) : undefined), [placeId])
  const day = date < todayKey() ? todayKey() : date
  const next = addDays(day, 1)
  const items = useLiveQuery(() => (placeId ? loadItems([day, next]) : undefined), [placeId, day, next])

  const slots = useMemo(() => {
    if (!task || !items) return []
    const out: { day: string; start: number; len: number }[] = []
    for (const d of [day, next]) {
      const from = d === todayKey() ? snap(nowMinutes() + 2, 5) : settings.day_start
      const spans = items[d].filter((i) => !i.task.all_day)
      for (const r of freeRows(spans, settings.day_start, settings.day_end, 5, from)) if (r.len >= task.duration_min) out.push({ day: d, ...r })
    }
    return out.slice(0, 5)
  }, [task, items, day, next, settings.day_start, settings.day_end])

  useEffect(() => {
    if (!placeId) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ placeId: null })
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [placeId, set])

  if (!placeId || !task) return null
  const close = () => set({ placeId: null })
  return (
    <div className="sheet-wrap place-wrap" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet place-sheet" role="dialog" aria-modal="true" aria-labelledby="place-h" data-testid="place-picker">
        <header className="sheet-hd">
          <h2 id="place-h">Place: {task.title || 'Untitled'}</h2>
          <span className="mono muted" data-testid="place-meta">{fmtDur(task.duration_min)}{task.priority ? `, P${4 - task.priority}` : ''}</span>
        </header>
        <p className="lbl">Free slots that fit{slots.length ? '' : ' — none left today or tomorrow'}</p>
        <ul className="slots">
          {slots.map((s, i) => (
            <li key={`${s.day}-${s.start}`}>
              <button
                type="button"
                className={`slot ${i === 0 ? 'best' : ''}`}
                data-testid="slot"
                autoFocus={i === 0}
                onClick={() => {
                  void schedule(task, s.day, s.start)
                  set({ placeId: null, ...(s.day !== date ? { date: s.day } : {}) })
                }}
              >
                <span className="mono">{fmtClock(s.start, settings.clock24)}</span>
                <span className="m">{s.day === todayKey() ? 'today' : shortDay(fromKey(s.day))}, free {fmtDur(s.len)}</span>
                {i === 0 && <span className="fit mono">earliest</span>}
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="slot alt" onClick={() => set({ placeId: null, editingId: task.id })}>
              Pick a time or another day
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
