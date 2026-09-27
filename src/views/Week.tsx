import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Category, SettingsData } from '../data/types'
import { addDays, fmtClock, fmtHours, fromKey, shortDay, todayKey, weekStart } from '../lib/time'
import { useIsMobile } from '../lib/useMedia'
import { useUI } from '../state/ui'
import { useItems, type Item } from '../timeline/items'
import { freeRows, layoutColumns } from '../timeline/layout'
import { Icon } from '../icons/Icon'
import { useNow } from '../timeline/NowLine'

export const WEEK_HOUR_PX = 40

const WBlock = memo(function WBlock({ item, col, cols, cat, clock24 }: { item: Item; col: number; cols: number; cat?: Category; clock24: boolean }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `wblk:${item.key}`, data: { type: 'block', item } })
  const h = Math.max(16, (item.task.duration_min / 60) * WEEK_HOUR_PX - 2)
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable block"
      aria-label={`${item.task.title || 'Untitled'}, ${fmtClock(item.start, clock24)}`}
      className={`wblk cat-${cat?.color ?? 'errand'} ${item.task.completed_at ? 'done' : ''} ${isDragging ? 'grab' : ''}`}
      style={{
        top: (item.start / 60) * WEEK_HOUR_PX,
        height: h,
        left: `calc(${(100 * col) / cols}% + 2px)`,
        width: `calc(${100 / cols}% - 4px)`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      onClick={() => set({ editingId: item.key })}
      data-testid="week-block"
      data-id={item.task.id}
    >
      <span className="wt">
        {h >= 30 && <Icon name={cat?.icon ?? 'dot'} size={11} />}
        <span className="tt">{item.task.title || 'Untitled'}</span>
      </span>
      {h >= 30 && <span className="wm mono">{fmtClock(item.start, clock24)}</span>}
    </button>
  )
})

function DayColumn({ day, items, cats, settings, isToday, now }: { day: string; items: Item[]; cats: Map<string, Category>; settings: SettingsData; isToday: boolean; now: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { type: 'day', day, hourPx: WEEK_HOUR_PX } })
  const timed = items.filter((i) => !i.task.all_day)
  const placed = layoutColumns(timed.map((i) => ({ id: i.key, start: i.start, end: i.end })))
  const by = new Map(timed.map((i) => [i.key, i]))
  // #4: free time stays visible one view out — compact, unlabelled rows for gaps of 30 min or more
  const free = freeRows(timed, settings.day_start, settings.day_end, 30)
  return (
    <div className={`wcol ${isOver ? 'over' : ''} ${isToday ? 'today' : ''}`} ref={setNodeRef} data-testid="week-col" data-day={day}>
      <div className="oob" style={{ top: 0, height: (settings.day_start / 60) * WEEK_HOUR_PX }} />
      <div className="oob" style={{ top: (settings.day_end / 60) * WEEK_HOUR_PX, bottom: 0 }} />
      {free.map((r) => (
        <div key={r.start} className="wfree" style={{ top: (r.start / 60) * WEEK_HOUR_PX + 1, height: (r.len / 60) * WEEK_HOUR_PX - 2 }} data-testid="week-free" aria-hidden="true" />
      ))}
      {placed.map((p) => (
        <WBlock key={p.id} item={by.get(p.id)!} col={p.col} cols={p.cols} cat={cats.get(by.get(p.id)!.task.category_id ?? '')} clock24={settings.clock24} />
      ))}
      {isToday && <div className="wnow" style={{ top: (now / 60) * WEEK_HOUR_PX }} />}
    </div>
  )
}

export function Week({ date, cats, settings }: { date: string; cats: Map<string, Category>; settings: SettingsData }) {
  const set = useUI((s) => s.set)
  const mobile = useIsMobile()
  const start = weekStart(date, settings.week_start)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const items = useItems(days)
  const now = useNow()
  const today = todayKey()
  const scroller = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = (settings.day_start / 60) * WEEK_HOUR_PX
  }, [start, settings.day_start])

  const headers = days.map((d) => {
    const its = items?.[d] ?? []
    const timed = its.filter((i) => !i.task.all_day)
    const planned = timed.reduce((a, i) => a + Math.max(0, Math.min(i.end, settings.day_end) - Math.max(i.start, settings.day_start)), 0)
    const free = freeRows(timed, settings.day_start, settings.day_end, 1).reduce((a, r) => a + r.len, 0)
    return (
      <button type="button" key={d} className={`wday ${d === today ? 'today' : ''} ${d === date ? 'sel' : ''}`} onClick={() => set({ date: d, view: 'day', mobileTab: 'board' })} data-testid="week-day">
        <b>{shortDay(fromKey(d))}</b>
        <span className="mono" data-testid="week-hours">
          {fmtHours(planned)} plan · {fmtHours(free)} free
        </span>
      </button>
    )
  })
  useLayoutEffect(() => {
    // mobile shows three days at a time: open on yesterday so today sits in the middle
    const el = scroller.current
    if (!el || !mobile) return
    const i = Math.max(0, days.indexOf(today) - 1)
    const col = el.querySelector<HTMLElement>(`[data-testid="week-col"][data-day="${days[i]}"]`)
    if (col) el.scrollTo({ left: col.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft - 32, behavior: 'instant' as ScrollBehavior })
  }, [mobile, days, today])

  return (
    <section className={`week ${mobile ? 'm' : ''}`} aria-label="Week">
      <div className="whead">
        <div className="wnav">
          <button type="button" className="nav" aria-label="Previous week" onClick={() => set({ date: addDays(date, -7) })}>‹</button>
          <button type="button" className="nav" aria-label="Next week" onClick={() => set({ date: addDays(date, 7) })}>›</button>
        </div>
        {headers}
      </div>
      {mobile && (
        <div className="wbar">
          <button type="button" className="nav" aria-label="Previous week" onClick={() => set({ date: addDays(date, -7) })}>‹</button>
          <b>Week of {shortDay(fromKey(start))}</b>
          <button type="button" className="nav" aria-label="Next week" onClick={() => set({ date: addDays(date, 7) })}>›</button>
        </div>
      )}
      <div className="wbody" ref={scroller}>
        <div className="wgrid" style={mobile ? undefined : { height: 24 * WEEK_HOUR_PX }}>
          {mobile && (
            <div className="whead-m">
              <div className="corner" />
              {headers}
            </div>
          )}
          <div className="wrail" aria-hidden="true">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="hour" style={{ top: h * WEEK_HOUR_PX }}>
                <b className="mono">{fmtClock(h * 60, settings.clock24).replace(':00', '')}</b>
              </div>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn key={d} day={d} items={items?.[d] ?? []} cats={cats} settings={settings} isToday={d === today} now={now} />
          ))}
        </div>
      </div>
    </section>
  )
}
