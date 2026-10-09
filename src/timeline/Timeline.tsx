// The day spine (arc 6 slice 3, mockups 01 / 08 / 09). Every row — bookend anchors, tasks, calendar events, free gaps,
// the now marker, the drop / paint ghosts and the gutter — is placed by ONE segment map (segments.ts). Planner's drop
// maths reads the same map through `segmentMaps`.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { BOOKEND_NAMES, type Category, type SettingsData } from '../data/types'
import { updateSettings } from '../data/repo'
import { addDays, fmtClock, isoAt, todayKey } from '../lib/time'
import { useIsMobile } from '../lib/useMedia'
import { useDrag } from '../state/drag'
import { useUI } from '../state/ui'
import { paintBlock, resizeItem, toggleComplete } from '../actions'
import { AllDayStrip } from './AllDayStrip'
import { AnchorRow } from './AnchorRow'
import { CAPSULE_MIN, NodeRow } from './NodeRow'
import { Gap } from './Gap'
import { Rail } from './Rail'
import { NowLine, useNow } from './NowLine'
import type { Item } from './items'
import { isLate, layoutColumns, snap as snapTo } from './layout'
import { ANCHOR_END, ANCHOR_START, buildSegments, railLabels, type SegmentMap } from './segments'
import { taskIcon } from '../quickadd/suggest'
import { EventBlock } from './EventBlock'
import type { EventItem } from '../calendar/events'
import { PaintGhost, PaintSlot } from './PaintLayer'
import { usePaint } from './usePaint'
import './spine.css'

/** Timeline inner elements by day — drop maths reads their live rect. */
export const timelineEls = new Map<string, HTMLElement>()
/** The segment map each mounted day is laid out with — drop maths converts with it (arc 6 RULE: one map). */
export const segmentMaps = new Map<string, SegmentMap>()

/** Space under the last row: the floating tab bar on iPhone, a little air on the desktop. */
const PAD_BOTTOM_MOBILE = 140
const PAD_BOTTOM_DESKTOP = 48

function DropGhost({ day, map, clock24 }: { day: string; map: SegmentMap; clock24: boolean }) {
  const ghost = useDrag((s) => (s.ghost?.day === day ? s.ghost : null))
  if (!ghost) return null
  const top = map.minToY(ghost.start)
  return (
    <div className="ghost" style={{ transform: `translateY(${top}px)`, height: Math.max(8, map.minToY(ghost.start + ghost.len) - top) }} data-testid="drop-ghost">
      <i className="tnum">{fmtClock(ghost.start, clock24)}</i>
    </div>
  )
}

/** Keep the last 14 days of bookend ticks (settings is one synced row; it must not grow forever). */
export function nextBookendDone(cur: SettingsData['bookend_done'], day: string, which: 'start' | 'end'): NonNullable<SettingsData['bookend_done']> {
  const out: NonNullable<SettingsData['bookend_done']> = {}
  const floor = addDays(todayKey(), -14)
  for (const [d, v] of Object.entries(cur ?? {})) if (d >= floor) out[d] = { ...v }
  const was = !!out[day]?.[which]
  out[day] = { ...out[day], [which]: !was }
  if (!out[day].start && !out[day].end) delete out[day]
  return out
}

export function Timeline({ day, items, events = [], cats, settings, overlay }: { day: string; items: Item[]; events?: EventItem[]; cats: Map<string, Category>; settings: SettingsData; overlay?: (map: SegmentMap) => ReactNode }) {
  const mobile = useIsMobile()
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

  // the one map: tasks + events + the two bookends
  const map = useMemo(
    () =>
      buildSegments(
        timed.map((i) => ({ key: i.key, start: i.start, end: i.start + Math.max(1, i.task.duration_min) })),
        timedEvents.map((e) => ({ key: e.key, start: e.start, end: e.end })),
        settings.day_start,
        settings.day_end,
        { padBottom: mobile ? PAD_BOTTOM_MOBILE : PAD_BOTTOM_DESKTOP },
      ),
    [timed, timedEvents, settings.day_start, settings.day_end, mobile],
  )
  useEffect(() => {
    segmentMaps.set(day, map)
    return () => {
      if (segmentMaps.get(day) === map) segmentMaps.delete(day)
    }
  }, [day, map])
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  }, [map])

  // concurrent tasks / events: side-by-side columns (column k sits k × 64 px right of the spine)
  const placed = useMemo(
    () => layoutColumns([...timed.map((i) => ({ id: i.key, start: i.start, end: i.start + Math.max(1, i.task.duration_min) })), ...timedEvents.map((e) => ({ id: e.key, start: e.start, end: e.end }))]),
    [timed, timedEvents],
  )
  const colOf = useMemo(() => new Map(placed.map((p) => [p.id, p.col])), [placed])
  const byKey = useMemo(() => new Map(timed.map((i) => [i.key, i])), [timed])
  // concurrent clusters: texts stack one 56 px line apart, right of the cluster's last chip column
  const stacked = useMemo(() => {
    const out = new Map<string, { cols: number; y: number }>()
    for (const seg of map.segments) {
      const keys = seg.keys.filter((k) => k !== ANCHOR_START && k !== ANCHOR_END)
      if (seg.kind !== 'node' || keys.length < 2) continue
      const cols = Math.max(...keys.map((k) => colOf.get(k) ?? 0))
      keys.forEach((k, i) => out.set(k, { cols, y: seg.y + 36 + i * 56 }))
    }
    return out
  }, [map, colOf])

  const anchorSeg = (key: string) => map.segments.find((s) => s.keys.includes(key))
  const startSeg = anchorSeg(ANCHOR_START)
  const endSeg = anchorSeg(ANCHOR_END)
  const labels = useMemo(() => {
    const rows = [
      { start: settings.day_start, end: settings.day_start + 1, capsule: false },
      { start: settings.day_end, end: settings.day_end + 1, capsule: false },
      ...timed.map((i) => ({ start: i.start, end: i.start + i.task.duration_min, capsule: i.task.duration_min >= CAPSULE_MIN })),
      ...timedEvents.map((e) => ({ start: e.start, end: e.end, capsule: e.end - e.start >= CAPSULE_MIN })),
    ]
    return railLabels(map, rows)
  }, [map, timed, timedEvents, settings.day_start, settings.day_end])

  // virtualise by segment y: rows within the viewport ± two screens are mounted (a spine day is short — compressed
  // gaps — so this is most of a normal day and only trims dense libraries)
  const [view, setView] = useState({ top: 0, h: 0 })
  const winTop = view.h ? view.top - 2 * view.h : -Infinity
  const winBottom = view.h ? view.top + 3 * view.h : Infinity
  const visible = timed.filter((i) => map.minToY(i.start + i.task.duration_min) >= winTop && map.minToY(i.start) <= winBottom)

  // perf budget probe: data ready → rows committed and painted (docs/spec.md §2.9)
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

  // initial scroll: a little above now on today, else the top (the morning bookend). The day's rows arrive after the
  // first render and re-lay the map, so the auto position follows the map until the user scrolls away from it.
  const auto = useRef<{ day: string; y: number } | null>(null)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (auto.current?.day === day && Math.abs(el.scrollTop - auto.current.y) > 1) return // the user has scrolled
    el.scrollTop = isToday ? Math.max(0, map.minToY(now) - 160) : 0
    auto.current = { day, y: el.scrollTop }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, map])

  // track the viewport (rAF-throttled) in the inner element's coordinates
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const read = () => setView({ top: el.scrollTop - (innerRef.current?.offsetTop ?? 0), h: el.clientHeight })
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

  const onOpen = useCallback((item: Item) => set({ editingId: item.key, selectedId: item.key }), [set])
  const onFocusItem = useCallback((item: Item) => {
    if (useUI.getState().selectedId !== item.key) useUI.getState().set({ selectedId: item.key })
  }, [])
  const onToggle = useCallback((item: Item) => void toggleComplete(item), [])
  const onResize = useCallback((item: Item, d: number) => void resizeItem(item, d), [])
  const openDaySettings = useCallback(() => {
    set({ view: 'settings', mobileTab: 'board', selectedId: null })
    requestAnimationFrame(() => document.getElementById('set-day')?.scrollIntoView({ block: 'start' }))
  }, [set])
  const onBookend = useCallback((which: 'start' | 'end') => void updateSettings({ bookend_done: nextBookendDone(settings.bookend_done, day, which) }), [settings.bookend_done, day])

  // paint a block (arc 5a): press-drag on empty space; the keyboard slot shares the ghost and the commit
  const ghostRef = useRef<HTMLDivElement>(null)
  const onPaint = useCallback((start: number, len: number) => void paintBlock(day, start, len), [day])
  usePaint(innerRef, scrollRef, ghostRef, { day, map, snap: settings.snap, clock24: settings.clock24, onCommit: onPaint })
  const onSlotPaint = useCallback(
    async (start: number, len: number) => {
      const row = await paintBlock(day, start, len)
      // hand focus to the new row's chip so Enter opens its editor
      for (let i = 0; i < 30; i++) {
        const btn = innerRef.current?.querySelector<HTMLElement>(`[data-id="${row.id}"] .node-chip`)
        if (btn) return btn.focus()
        await new Promise((r) => requestAnimationFrame(r))
      }
    },
    [day],
  )
  const busyAt = useCallback(
    (min: number) => {
      const hit = timed.find((i) => i.start <= min && min < i.end) ?? timedEvents.find((e) => e.start <= min && min < e.end)
      if (!hit) return null
      return 'task' in hit ? hit.task.title || 'Untitled' : hit.event.title || 'an event'
    },
    [timed, timedEvents],
  )
  const slotStart = useCallback(() => (isToday ? now : mapRef.current.yToMin(view.top)), [isToday, now, view.top])

  const createAt = useCallback(
    (min: number, room = settings.default_duration) => {
      useUI.getState().openWizard('timeline', { start_at: isoAt(day, min), duration_min: Math.min(settings.default_duration, room) })
    },
    [day, settings.default_duration],
  )
  const onGapAdd = useCallback(
    (start: number) => {
      const seg = map.segments.find((s) => s.kind === 'gap' && s.from === start)
      createAt(start, seg ? seg.to - seg.from : settings.default_duration)
    },
    [map, createAt, settings.default_duration],
  )
  function onBackground(e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    if (useUI.getState().selectedId) {
      set({ selectedId: null })
      return
    }
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    createAt(Math.floor(snapTo(map.yToMin(y), 1) / 15) * 15)
  }

  const names = { start: settings.day_start_name?.trim() || BOOKEND_NAMES.start, end: settings.day_end_name?.trim() || BOOKEND_NAMES.end }
  const ticked = settings.bookend_done?.[day] ?? {}
  return (
    <div className="tl spine-tl" ref={scrollRef} data-testid="timeline" data-day={day}>
      <AllDayStrip tasks={allDay} events={allDayEvents.map((e) => e.event)} cats={cats} />
      <div className="tl-inner" ref={setInner} style={{ height: map.height }} onClick={onBackground} role="presentation">
        <PaintSlot map={map} snap={settings.snap} clock24={settings.clock24} startAt={slotStart} ghostRef={ghostRef} busy={busyAt} onCommit={onSlotPaint} />
        <Rail map={map} labels={labels} clock24={settings.clock24} />
        {map.segments
          .filter((s) => s.kind === 'gap')
          .map((s) => (
            <Gap key={`${s.from}`} day={day} from={s.from} to={s.to} y={s.y} h={s.h} clock24={settings.clock24} onAdd={onGapAdd} />
          ))}
        {startSeg && <AnchorRow which="start" min={settings.day_start} y={startSeg.y} h={startSeg.kind === 'anchor' ? startSeg.h : 72} name={names.start} done={!!ticked.start} clock24={settings.clock24} onOpen={openDaySettings} onToggle={onBookend} />}
        {endSeg && <AnchorRow which="end" min={settings.day_end} y={endSeg.kind === 'anchor' ? endSeg.y : map.minToY(settings.day_end)} h={endSeg.kind === 'anchor' ? endSeg.h : 72} name={names.end} done={!!ticked.end} clock24={settings.clock24} onOpen={openDaySettings} onToggle={onBookend} />}
        {timedEvents
          .filter((e) => map.minToY(e.end) >= winTop && map.minToY(e.start) <= winBottom)
          .map((e) => (
            <EventBlock key={e.key} item={e} map={map} col={colOf.get(e.key) ?? 0} textCols={stacked.get(e.key)?.cols} textTop={stacked.has(e.key) ? stacked.get(e.key)!.y - map.minToY(e.start) : undefined} clock24={settings.clock24} />
          ))}
        {visible.map((item) => {
          const cat = cats.get(item.task.category_id ?? '')
          return (
            <NodeRow
              key={item.key}
              item={byKey.get(item.key)!}
              map={map}
              col={colOf.get(item.key) ?? 0}
              textCols={stacked.get(item.key)?.cols}
              textTop={stacked.has(item.key) ? stacked.get(item.key)!.y - map.minToY(item.start) : undefined}
              cat={cat}
              icon={taskIcon(item.task.title, cat?.icon, settings.iconOverrides)}
              selected={selectedKey === item.key}
              running={isToday && !item.task.completed_at && now >= item.start && now < item.end}
              late={isLate(item.end, !!item.task.completed_at, isToday ? now : null)}
              clock24={settings.clock24}
              snap={settings.snap}
              onOpen={onOpen}
              onFocusItem={onFocusItem}
              onToggle={onToggle}
              onResize={onResize}
            />
          )
        })}
        {isToday && <NowLine now={now} y={map.minToY(now)} clock24={settings.clock24} />}
        <DropGhost day={day} map={map} clock24={settings.clock24} />
        <PaintGhost ref={ghostRef} />
        {overlay?.(map)}
      </div>
    </div>
  )
}
