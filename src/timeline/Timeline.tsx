import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Category, SettingsData } from '../data/types'
import { fmtClock, isoAt, todayKey } from '../lib/time'
import { useHourPx } from '../lib/useMedia'
import { useDrag } from '../state/drag'
import { useUI } from '../state/ui'
import { patchItem, resizeItem, toggleComplete } from '../actions'
import { AllDayStrip } from './AllDayStrip'
import { Block, pillHeight } from './Block'
import { FreeGap } from './FreeGap'
import { HourRail } from './HourRail'
import { NowLine, useNow } from './NowLine'
import type { Item } from './items'
import { clusterShort, freeRows, isLate, isOutOfBounds, layoutColumns } from './layout'
import { visibleWindow } from './virtual'
import { taskIcon } from '../quickadd/suggest'
import { EventBlock } from './EventBlock'
import type { EventItem } from '../calendar/events'

/** Timeline inner elements by day — drop maths reads their live rect. */
export const timelineEls = new Map<string, HTMLElement>()

function DropGhost({ day, hourPx, clock24 }: { day: string; hourPx: number; clock24: boolean }) {
  const ghost = useDrag((s) => (s.ghost?.day === day ? s.ghost : null))
  if (!ghost) return null
  return (
    <div className="ghost" style={{ transform: `translateY(${(ghost.start / 60) * hourPx}px)`, height: (ghost.len / 60) * hourPx }} data-testid="drop-ghost">
      <i className="mono">{fmtClock(ghost.start, clock24)}</i>
    </div>
  )
}

/** "+n" pill standing in for three or more short pills within 30 min; opens a list (design spec §4). */
function ClusterPill({ items, hourPx, clock24, cats }: { items: Item[]; hourPx: number; clock24: boolean; cats: Map<string, Category> }) {
  const [open, setOpen] = useState(false)
  const set = useUI((s) => s.set)
  const first = items[0]
  const end = Math.max(...items.map((i) => i.end))
  return (
    <div className="cluster" style={{ top: (first.start / 60) * hourPx, height: pillHeight(end - first.start, hourPx) }} data-testid="cluster">
      <button type="button" className="cluster-btn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen(!open) }} aria-label={`${items.length} short tasks from ${fmtClock(first.start, clock24)}`}>
        <span className="tnum">{fmtClock(first.start, clock24)}</span>
        <b>+{items.length}</b>
      </button>
      {open && (
        <ul className="cluster-list" onClick={(e) => e.stopPropagation()}>
          {items.map((i) => (
            <li key={i.key}>
              <button type="button" className={`cluster-row cat-${cats.get(i.task.category_id ?? '')?.color ?? 'errand'} ${i.task.completed_at ? 'done' : ''}`} onClick={() => set({ editingId: i.key, selectedId: i.key })}>
                <span className="tnum">{fmtClock(i.start, clock24)}</span> {i.task.title || 'Untitled'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function Timeline({ day, items, events = [], cats, settings }: { day: string; items: Item[]; events?: EventItem[]; cats: Map<string, Category>; settings: SettingsData }) {
  const hourPx = useHourPx()
  const now = useNow()
  const isToday = day === todayKey()
  const selectedKey = useUI((s) => s.selectedId)
  const set = useUI((s) => s.set)
  const scrollRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement | null>(null)
  const { setNodeRef } = useDroppable({ id: `tl:${day}`, data: { type: 'timeline', day } })
  const setInner = useCallback(
    (el: HTMLDivElement | null) => {
      innerRef.current = el
      setNodeRef(el)
      if (el) timelineEls.set(day, el)
      else timelineEls.delete(day)
    },
    [day, setNodeRef],
  )

  const timed = useMemo(() => items.filter((i) => !i.task.all_day), [items])
  const allDay = useMemo(() => items.filter((i) => i.task.all_day).map((i) => i.task), [items])
  const timedEvents = useMemo(() => events.filter((e) => !e.event.all_day), [events])
  const allDayEvents = useMemo(() => events.filter((e) => e.event.all_day), [events])
  // tasks and calendar events share the overlap columns
  const placedAll = useMemo(
    () => layoutColumns([...timed.map((i) => ({ id: i.key, start: i.start, end: i.end })), ...timedEvents.map((e) => ({ id: e.key, start: e.start, end: e.end }))]),
    [timed, timedEvents],
  )
  const placed = useMemo(() => placedAll.filter((p) => !p.id.startsWith('ev:')), [placedAll])
  const placedEvents = useMemo(() => placedAll.filter((p) => p.id.startsWith('ev:')), [placedAll])
  const eventByKey = useMemo(() => new Map(timedEvents.map((e) => [e.key, e])), [timedEvents])
  const byKey = useMemo(() => new Map(timed.map((i) => [i.key, i])), [timed])
  // gaps ≥ 10 min, and tall enough to show beside a min-height pill above them (≥ 28px)
  const free = useMemo(
    () => freeRows([...timed, ...timedEvents], settings.day_start, settings.day_end, 10).filter((r) => (r.len / 60) * hourPx >= 28),
    [timed, timedEvents, settings.day_start, settings.day_end, hourPx],
  )
  const catList = useMemo(() => [...cats.values()], [cats])
  // three or more short pills within 30 min collapse into a "+n" pill (the selected one stays out)
  const clusters = useMemo(
    () => clusterShort(placed.filter((p) => p.id !== selectedKey)).map((ids) => ids.map((id) => byKey.get(id)!)),
    [placed, byKey, selectedKey],
  )
  const clustered = useMemo(() => new Set(clusters.flat().map((i) => i.key)), [clusters])

  // virtualise: only blocks within the viewport ± one screen are mounted (slice 6)
  const [view, setView] = useState({ top: 0, h: 0 })
  const win = visibleWindow(view.top, view.h, hourPx)
  const visible = placed.filter((p) => p.end >= win.from && p.start <= win.to && !clustered.has(p.id))

  // perf budget probe: data ready → blocks committed and painted (docs/spec.md §2.9)
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      performance.mark('optimo:day-paint')
      try {
        performance.measure('optimo:day-ready', 'optimo:day-data', 'optimo:day-paint')
      } catch {
        /* no data mark yet */
      }
    })
    return () => cancelAnimationFrame(raf)
  }, [items])

  // initial scroll: an hour before now on today, else the day start
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const target = isToday ? Math.max(0, now - 60) : settings.day_start
    el.scrollTop = (target / 60) * hourPx
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, hourPx])

  // track the viewport (rAF-throttled) so virtualisation follows scrolling
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const read = () => setView({ top: el.scrollTop, h: el.clientHeight })
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(read)
    }
    on()
    el.addEventListener('scroll', on, { passive: true })
    const ro = new ResizeObserver(on)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', on)
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  const onSelect = useCallback(
    (item: Item) => {
      const s = useUI.getState()
      if (s.selectedId === item.key) set({ editingId: item.key })
      else set({ selectedId: item.key })
    },
    [set],
  )
  const onToggle = useCallback((item: Item) => void toggleComplete(item), [])
  const onResize = useCallback((item: Item, d: number) => void resizeItem(item, d), [])
  const onCategory = useCallback((item: Item, category_id: string) => void patchItem(item, { category_id }, 'Category changed'), [])

  function createAt(min: number, len = settings.default_duration) {
    set({ draft: { start_at: isoAt(day, min), duration_min: len }, selectedId: null })
  }
  function onBackground(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (useUI.getState().selectedId) {
      set({ selectedId: null })
      return
    }
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    createAt(Math.floor(((y / hourPx) * 60) / 15) * 15)
  }

  return (
    <div className="tl" ref={scrollRef} data-testid="timeline" data-day={day}>
      <AllDayStrip tasks={allDay} events={allDayEvents.map((e) => e.event)} cats={cats} />
      <div
        className="tl-inner"
        ref={setInner}
        style={{ height: 24 * hourPx, ['--hour' as string]: `${hourPx}px` }}
        onClick={onBackground}
        role="presentation"
      >
        <HourRail hourPx={hourPx} dayStart={settings.day_start} dayEnd={settings.day_end} clock24={settings.clock24} now={isToday ? now : null} />
        {free.map((r) => (
          <FreeGap key={`${r.start}`} gap={r} day={day} hourPx={hourPx} clock24={settings.clock24} defaultDuration={settings.default_duration} onAdd={createAt} />
        ))}
        {placedEvents
          .filter((p) => p.end >= win.from && p.start <= win.to)
          .map((p) => (
            <EventBlock key={p.id} item={eventByKey.get(p.id)!} col={p.col} cols={p.cols} hourPx={hourPx} clock24={settings.clock24} />
          ))}
        {clusters.map((c) => (
          <ClusterPill key={c[0].key} items={c} hourPx={hourPx} clock24={settings.clock24} cats={cats} />
        ))}
        {visible.map((p) => {
          const item = byKey.get(p.id)!
          return (
            <Block
              key={p.id}
              item={item}
              col={p.col}
              cols={p.cols}
              hourPx={hourPx}
              cat={cats.get(item.task.category_id ?? '')}
              cats={catList}
              icon={taskIcon(item.task.title, cats.get(item.task.category_id ?? '')?.icon, settings.iconOverrides)}
              selected={selectedKey === item.key}
              running={isToday && !item.task.completed_at && now >= item.start && now < item.end}
              late={isLate(item.end, !!item.task.completed_at, isToday ? now : null)}
              dim={isOutOfBounds(item, settings.day_start, settings.day_end)}
              clock24={settings.clock24}
              snap={settings.snap}
              now={now}
              onSelect={onSelect}
              onToggle={onToggle}
              onResize={onResize}
              onCategory={onCategory}
            />
          )
        })}
        {isToday && <NowLine now={now} hourPx={hourPx} clock24={settings.clock24} />}
        <DropGhost day={day} hourPx={hourPx} clock24={settings.clock24} />
      </div>
    </div>
  )
}
