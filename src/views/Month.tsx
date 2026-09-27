import type { Category, SettingsData } from '../data/types'
import { addDays, dateKey, fromKey, monthTitle, todayKey, weekStart, weekdayName } from '../lib/time'
import { useUI } from '../state/ui'
import { useItems } from '../timeline/items'

/** Month: dot density per day (one dot per task in chip colours, max 4 + "+n"); tap = jump to that day. */
export function Month({ date, cats, settings }: { date: string; cats: Map<string, Category>; settings: SettingsData }) {
  const set = useUI((s) => s.set)
  const d = fromKey(date)
  const first = dateKey(new Date(d.getFullYear(), d.getMonth(), 1))
  const gridStart = weekStart(first, settings.week_start)
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const items = useItems(days)
  const today = todayKey()
  const month = d.getMonth()
  const shift = (n: number) => set({ date: dateKey(new Date(d.getFullYear(), d.getMonth() + n, 1)) })

  return (
    <section className="month" aria-labelledby="month-h">
      <header className="mhead">
        <button type="button" className="nav" aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
        <h2 id="month-h">{monthTitle(d)}</h2>
        <button type="button" className="nav" aria-label="Next month" onClick={() => shift(1)}>›</button>
      </header>
      <div className="mgrid" role="grid" aria-labelledby="month-h">
        <div className="mrow" role="row">
          {days.slice(0, 7).map((k) => (
            <span key={k} role="columnheader" className="mdow">
              {weekdayName(fromKey(k))}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, w) => (
          <div className="mrow" role="row" key={w}>
            {days.slice(w * 7, w * 7 + 7).map((k) => {
              const its = items?.[k] ?? []
              const n = its.length
              const doneN = its.filter((i) => i.task.completed_at).length
              return (
                <span role="gridcell" key={k}>
                  <button
                    type="button"
                    className={`mday ${fromKey(k).getMonth() === month ? '' : 'out'} ${k === today ? 'today' : ''} ${k === date ? 'sel' : ''}`}
                    onClick={() => set({ date: k, view: 'day', mobileTab: 'board' })}
                    aria-label={`${fromKey(k).toDateString()}: ${n} task${n === 1 ? '' : 's'}${n ? `, ${doneN} done` : ''}`}
                    data-testid="month-day"
                    data-count={n}
                  >
                    <b className="mono">{fromKey(k).getDate()}</b>
                    <span className="dots" aria-hidden="true">
                      {its.slice(0, 4).map((i) => (
                        <i key={i.key} className={`cat-${cats.get(i.task.category_id ?? '')?.color ?? 'errand'} ${i.task.completed_at ? 'done' : ''}`} />
                      ))}
                      {n > 4 && <em className="tnum">+{n - 4}</em>}
                    </span>
                  </button>
                </span>
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
