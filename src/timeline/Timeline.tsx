import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Category, SettingsData } from '../data/types'
import { fmtClock, isoAt, todayKey } from '../lib/time'
import { useHourPx } from '../lib/useMedia'
import { useDrag } from '../state/drag'
import { useUI } from '../state/ui'
import { resizeItem, toggleComplete } from '../actions'
import { AllDayStrip } from './AllDayStrip'
import { Block } from './Block'
import { FreeRow } from './FreeRow'
import { HourRail } from './HourRail'
import { NowLine, useNow } from './NowLine'
import type { Item } from './items'
import { freeRows, isOutOfBounds, layoutColumns } from './layout'
import { visibleWindow } from './virtual'

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

export function Timeline({ day, items, cats, settings }: { day: string; items: Item[]; cats: Map<string, Category>; settings: SettingsData }) {
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
  const placed = useMemo(() => layoutColumns(timed.map((i) => ({ id: i.key, start: i.start, end: i.end }))), [timed])
  const byKey = useMemo(() => new Map(timed.map((i) => [i.key, i])), [timed])
  const free = useMemo(() => freeRows(timed, settings.day_start, settings.day_end, 15), [timed, settings.day_start, settings.day_end])

  // virtualise: only blocks within the viewport ± one screen are mounted (slice 6)
  const [view, setView] = useState({ top: 0, h: 0 })
  const win = visibleWindow(view.top, view.h, hourPx)
  const visible = placed.filter((p) => p.end >= win.from && p.start <= win.to)

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

  function createAt(min: number) {
    set({ draft: { start_at: isoAt(day, min), duration_min: settings.default_duration }, selectedId: null })
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
      <AllDayStrip tasks={allDay} cats={cats} />
      <div
        className="tl-inner"
        ref={setInner}
        style={{ height: 24 * hourPx, ['--hour' as string]: `${hourPx}px` }}
        onClick={onBackground}
        role="presentation"
      >
        <HourRail hourPx={hourPx} dayStart={settings.day_start} dayEnd={settings.day_end} clock24={settings.clock24} />
        {free.map((r) => (
          <FreeRow key={`${r.start}`} row={r} hourPx={hourPx} clock24={settings.clock24} onAdd={createAt} />
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
              selected={selectedKey === item.key}
              running={isToday && !item.task.completed_at && now >= item.start && now < item.end}
              dim={isOutOfBounds(item, settings.day_start, settings.day_end)}
              clock24={settings.clock24}
              snap={settings.snap}
              now={now}
              onSelect={onSelect}
              onToggle={onToggle}
              onResize={onResize}
            />
          )
        })}
        {isToday && <NowLine now={now} hourPx={hourPx} clock24={settings.clock24} />}
        <DropGhost day={day} hourPx={hourPx} clock24={settings.clock24} />
      </div>
    </div>
  )
}
