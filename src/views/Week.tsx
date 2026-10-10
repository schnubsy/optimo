// Week = seven spine columns (arc 6 slice 4, mockup 10). iPhone: the overview behind the collapsed day panel;
// desktop: the Week view under the segmented control. Each column lays its nodes out with its OWN segment map
// (segments.ts, linear: 0.6 px/min = 36 px/h, no compression) — the only minute↔pixel conversion — and registers it in
// `weekMaps` so Planner's drop-on-a-day maths converts with the same map.
//
// Arc 7 slice 5 — readable week: a column ≥ WIDE px shows every task as a card with its title + start time (narrower:
// the disc, with a tooltip + accessible name); concurrent tasks sit side by side in lanes (layout.ts layoutColumns),
// never on top of each other; calendar events are outlined and read-only; today carries the now-line. Desktop adds a
// header per day: "Xh planned · Yh free", the all-day items, and the day's "To place" tray (arc 7 slice 9, week part):
// tray items drag onto any column time or another day's header (`wplan:<day>` → planForDay).
import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Category, SettingsData, Task } from '../data/types'
import { usePlannedRange } from '../data/hooks'
import { addDays, fmtClock, fromKey, shortDay, todayKey, weekStart } from '../lib/time'
import { useIsMobile } from '../lib/useMedia'
import { useDrag } from '../state/drag'
import { useUI } from '../state/ui'
import { useItems, type Item } from '../timeline/items'
import { layoutColumns } from '../timeline/layout'
import { useNow } from '../timeline/NowLine'
import { buildSegments, type SegmentMap } from '../timeline/segments'
import { useEvents, type EventItem } from '../calendar/events'
import { Icon } from '../icons/Icon'
import { taskIcon } from '../quickadd/suggest'
import { dayStats } from './stats'
import '../chrome/panel.css'

/** The week column map: 36 px per hour, linear, with the two bookends (arc 6 RULE: one map). */
export const WEEK_SEG_OPTS = { minPx: 0.6, compress: false, rowMin: 0, padTop: 0, anchors: true } as const
/** Week node: a 48 px disc, or a 48-wide capsule when the duration is taller than that at 36 px/h. */
export const WEEK_NODE = 48
/** Room above the first hour so the first label / disc are not flush with the top. */
const PAD_TOP = 12
/** A column at least this wide shows titles + times (arc 7 slice 5). */
export const WEEK_WIDE = 110
/** Readable cards: the shortest card, the height from which the time gets its own line, the bookend disc. */
const CARD_MIN = 22
const TWO_LINE = 34
const BOOKEND_WIDE = 22
/** Cards inset 2 px from the column edges; the spine runs through lane 0's icons (2 + 5 padding + 9 = half a 18 px icon). */
const INSET = 2
const SPINE_X_WIDE = 16
/** The tray lists this many items, then "+n more". */
const TRAY_ROWS = 4

/**
 * Each mounted column's map. `origin` is the map-y at the column element's top edge, so a column-relative y converts
 * as `map.yToMin(y + origin)`.
 */
export const weekMaps = new Map<string, { map: SegmentMap; origin: number }>()

/** category colour name → hue expression (mirrors the `.cat-*` classes in app.css) for the per-day spine gradient */
const HUE: Record<string, string> = {
  work: 'var(--cat-1-h)',
  meet: 'var(--cat-2-h)',
  health: 'var(--cat-3-h)',
  personal: 'var(--cat-4-h)',
  errand: 'var(--cat-5-h)',
  learn: 'var(--cat-6-h)',
  family: 'var(--cat-7-h)',
  home: 'var(--cat-8-h)',
  accent: '23.4',
}
const pastColor = (color: string) => `oklch(var(--past-l) var(--past-c) ${HUE[color] ?? HUE.errand})`

const LONG = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: 'short' })

/** "2h", "2h30", "45m" — the header's planned / free figures. */
export function fmtH(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}m`
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`
}

interface WNode {
  key: string
  start: number
  dur: number
  color: string
  icon: string
  item?: Item
  event?: EventItem
  anchor?: boolean
  title: string
}
/** A node's place in its column: px from the column top, its height, and its lane (col of cols). */
interface Box {
  top: number
  h: number
  col: number
  cols: number
}

/** Hour label: `9` + superscript `AM` (12 h) or `09` (24 h). */
function HourLabel({ min, clock24 }: { min: number; clock24: boolean }) {
  const h = Math.floor(min / 60) % 24
  if (clock24) return <b className="tnum">{String(h).padStart(2, '0')}</b>
  return (
    <b className="tnum">
      {h % 12 || 12}
      <sup>{h < 12 ? 'AM' : 'PM'}</sup>
    </b>
  )
}

/** Lane geometry as inline style: wide = cards filling their lane; narrow = discs centred in their lane. */
function laneStyle(b: Box, wide: boolean, laneW: number): CSSProperties {
  if (wide) return { left: `calc(${INSET}px + (100% - ${2 * INSET}px) * ${b.col / b.cols})`, width: `calc((100% - ${2 * INSET}px) / ${b.cols} - ${b.cols > 1 ? 2 : 0}px)`, marginLeft: 0 }
  if (b.cols === 1) return {}
  const w = Math.max(12, Math.min(40, laneW - 2))
  return { left: `calc(100% * ${(b.col + 0.5) / b.cols})`, width: w, marginLeft: -w / 2 }
}

const WeekNode = memo(function WeekNode({ n, box, past, mobile, day, wide, laneW, clock24 }: { n: WNode; box: Box; past: boolean; mobile: boolean; day: string; wide: boolean; laneW: number; clock24: boolean }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `wblk:${n.key}`, data: { type: 'block', item: n.item }, disabled: !n.item })
  // arc 7 slice 4: while dragged, the card shows where it will land
  const liveStart = useDrag((s) => (n.item && s.activeId === `wblk:${n.key}` && s.ghost?.where === 'week' ? s.ghost.start : null))
  const start = liveStart ?? n.start
  const time = fmtClock(start, clock24)
  const card = wide && !n.anchor
  const style: CSSProperties = {
    top: box.top,
    height: box.h,
    ...(n.anchor ? (wide ? { left: SPINE_X_WIDE, width: BOOKEND_WIDE, marginLeft: -BOOKEND_WIDE / 2 } : {}) : laneStyle(box, wide, laneW)),
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
  }
  const lane = card ? laneW / box.cols : laneW
  // a card's content: icon + text when the lane has room, text alone in a narrow lane, the icon alone in a sliver
  // two lines when the card is tall enough; a short card in a narrow lane stacks title + time in a tight 10 px pair
  // (side by side they would leave the title a sliver); otherwise one line, title then time
  const lines = box.h >= TWO_LINE ? 'two' : lane < 90 ? 'tight' : 'one'
  const showText = card && lane >= 40
  const showIcon = !card || (lane >= 72 && lines !== 'tight') || lane < 40
  const cls = `wnode cat-${n.color} ${card ? `card ${lines}` : ''} ${!card && box.h > WEEK_NODE ? 'capsule' : ''} ${n.event ? 'evt' : ''} ${n.anchor ? 'anchor' : ''} ${past ? 'past' : ''} ${n.item?.task.completed_at ? 'done' : ''} ${isDragging ? 'grab' : ''}`
  const tip = n.anchor ? undefined : `${n.title} · ${time}`
  const content = (
    <>
      {showIcon && !n.event && <Icon name={n.item?.task.completed_at ? 'ui-check' : n.icon} size={card ? 16 : n.anchor && wide ? 14 : Math.min(24, Math.max(12, lane - 8))} />}
      {showText ? (
        <span className="wn-tx">
          <span className="wn-title">{n.title}</span>
          <span className="wn-time tnum" data-testid="week-time">{time}</span>
        </span>
      ) : (
        !n.anchor && <span className="sr-only">{n.title}, {time}</span>
      )}
    </>
  )
  if (n.event)
    return (
      <span className={cls} style={style} title={tip} data-testid="week-event" data-start={n.start}>
        {content}
      </span>
    )
  if (!n.item)
    return (
      <span className={cls} style={style} data-testid="week-node" data-past={past || undefined} aria-hidden="true">
        {content}
      </span>
    )
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
      aria-label={`${n.title}, ${time}, ${LONG.format(fromKey(day))}`}
      title={tip}
      className={cls}
      style={style}
      // iPhone: a node is part of its column — tap opens that day; desktop: it opens the editor
      onClick={(e) => {
        e.stopPropagation()
        if (mobile) set({ date: day, panel: 'day' })
        else set({ editingId: n.key })
      }}
      data-testid="week-block"
      data-id={n.item.task.id}
      data-start={n.start}
      data-lanes={box.cols}
      data-live-start={liveStart ?? undefined}
      data-past={past || undefined}
    >
      {content}
    </button>
  )
})

/** Where a week drop will land (arc 7 slice 4), with its live start–end. */
function WeekGhost({ day, y, clock24 }: { day: string; y: (min: number) => number; clock24: boolean }) {
  const ghost = useDrag((s) => (s.ghost?.where === 'week' && s.ghost.day === day ? s.ghost : null))
  if (!ghost) return null
  return (
    <div className="wghost" style={{ top: y(ghost.start), height: Math.max(CARD_MIN, ghost.len * WEEK_SEG_OPTS.minPx) }} data-testid="week-ghost" data-start={ghost.start}>
      <i className="tnum">
        {fmtClock(ghost.start, clock24)}–{fmtClock(ghost.start + ghost.len, clock24)}
      </i>
    </div>
  )
}

function DayColumn({ day, nodes, settings, origin, past, mobile, hidden, wide, colW, now }: { day: string; nodes: WNode[]; settings: SettingsData; origin: number; past: boolean; mobile: boolean; hidden?: boolean; wide: boolean; colW: number; now: number | null }) {
  const set = useUI((s) => s.set)
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}`, data: { type: 'day', day }, disabled: hidden })
  // the column's own map (tasks + bookends): identical scale for every column, so the rows line up across the week
  const map = useMemo(
    () => buildSegments(nodes.filter((n) => n.item).map((n) => ({ key: n.key, start: n.start, end: n.start + Math.max(1, n.dur) })), [], settings.day_start, settings.day_end, WEEK_SEG_OPTS),
    [nodes, settings.day_start, settings.day_end],
  )
  const off = origin
  useEffect(() => {
    const entry = { map, origin: off }
    weekMaps.set(day, entry)
    return () => {
      if (weekMaps.get(day) === entry) weekMaps.delete(day)
    }
  }, [day, map, off])
  const y = useCallback((min: number) => map.minToY(min) - off, [map, off])

  // every node's box; tasks + events share lanes — wide: by their drawn extent (cards never cover each other);
  // narrow: by real concurrency (discs of back-to-back tasks keep the full width)
  const boxes = useMemo(() => {
    const out = new Map<string, Box>()
    const spans: { id: string; start: number; end: number }[] = []
    for (const n of nodes) {
      const top = n.anchor && wide ? y(n.start) - BOOKEND_WIDE / 2 : y(n.start)
      const h = n.anchor ? (wide ? BOOKEND_WIDE : WEEK_NODE) : Math.max(wide ? CARD_MIN : WEEK_NODE, n.dur * WEEK_SEG_OPTS.minPx)
      out.set(n.key, { top, h, col: 0, cols: 1 })
      if (n.anchor) continue
      if (wide) spans.push({ id: n.key, start: Math.round(top * 10), end: Math.round((top + h) * 10) })
      else spans.push({ id: n.key, start: n.start, end: n.start + Math.max(1, n.dur) })
    }
    for (const p of layoutColumns(spans)) {
      const b = out.get(p.id)!
      b.col = p.col
      b.cols = p.cols
    }
    return out
  }, [nodes, wide, y])

  // the day's spine: first node centre → last node centre (tasks + bookends; events are not on it)
  const onSpine = nodes.filter((n) => !n.event)
  const centres = onSpine.map((n) => {
    const b = boxes.get(n.key)!
    return b.top + b.h / 2
  })
  const spineTop = Math.min(...centres)
  const spineH = Math.max(0, Math.max(...centres) - spineTop)
  const first = onSpine[0]
  const last = onSpine[onSpine.length - 1]
  const spineBg = past ? `linear-gradient(to bottom, ${pastColor(first.color)}, ${pastColor(last.color)})` : undefined
  const open = () => set(mobile ? { date: day, panel: 'day' } : { date: day, view: 'day' })
  const laneW = (n: WNode) => (wide ? colW - 2 * INSET : colW / (boxes.get(n.key)?.cols ?? 1))
  return (
    <div className={`wcol ${isOver ? 'over' : ''} ${day === todayKey() ? 'today' : ''} ${wide ? 'wide' : ''}`} ref={setNodeRef} data-testid="week-col" data-day={day}>
      <button type="button" className="wcol-open" aria-label={`${LONG.format(fromKey(day))}, open the day`} onClick={open} data-testid="week-col-open" data-day={day} />
      <i className="wspine" style={{ top: spineTop, height: spineH, background: spineBg, ...(wide ? { left: SPINE_X_WIDE } : {}) }} data-testid="week-spine" aria-hidden="true" />
      {nodes.map((n) => (
        <WeekNode key={n.key} n={n} box={boxes.get(n.key)!} past={past} mobile={mobile} day={day} wide={wide} laneW={laneW(n)} clock24={settings.clock24} />
      ))}
      {now !== null && (
        <div className="wnow" style={{ top: y(now), ['--wnow-x' as string]: wide ? `${SPINE_X_WIDE}px` : '50%' }} data-testid="week-now" data-min={now} aria-hidden="true" />
      )}
      <WeekGhost day={day} y={y} clock24={settings.clock24} />
    </div>
  )
}

/** One "To place" item in a week tray: drags like an inbox row (shared drag contract), opens the editor on a click. */
const TrayItem = memo(function TrayItem({ task, cat, today }: { task: Task; cat?: Category; today: string }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `wtray:${task.id}`, data: { type: 'inbox', task } })
  const overdue = !!task.plan_date && task.plan_date < today && !task.completed_at
  const title = task.title || 'Untitled'
  return (
    <li ref={setNodeRef} className={`wtray-item cat-${cat?.color ?? 'errand'} ${isDragging ? 'grab' : ''} ${task.completed_at ? 'done' : ''}`} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }} data-testid="week-tray-item" data-id={task.id}>
      <button type="button" {...attributes} {...listeners} aria-roledescription="draggable task" aria-label={`${title}, to place${overdue ? `, from ${WEEKDAY.format(fromKey(task.plan_date!))}` : ''}`} title={title} onClick={() => set({ editingId: task.id })}>
        <i className="wtray-dot" aria-hidden="true" />
        <span className="wtray-t">{title}</span>
        {overdue && (
          <span className="wtray-from" data-testid="week-tray-from">
            from {WEEKDAY.format(fromKey(task.plan_date!))}
          </span>
        )}
      </button>
    </li>
  )
})

/** The day's "To place" tray: a list when the column is wide, a count chip that expands when it is narrow. */
function WeekTray({ day, tasks, wide, cats, today }: { day: string; tasks: Task[]; wide: boolean; cats: Map<string, Category>; today: string }) {
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  if (!tasks.length) return null
  const shown = more || !wide ? tasks : tasks.slice(0, TRAY_ROWS)
  const list = (
    <ul className="wtray-list" aria-label={`To place, ${LONG.format(fromKey(day))}`}>
      {shown.map((t) => (
        <TrayItem key={t.id} task={t} cat={cats.get(t.category_id ?? '')} today={today} />
      ))}
      {wide && tasks.length > TRAY_ROWS && (
        <li>
          <button type="button" className="wtray-more" onClick={() => setMore(!more)} data-testid="week-tray-more">
            {more ? 'Show less' : `+${tasks.length - TRAY_ROWS} more`}
          </button>
        </li>
      )}
    </ul>
  )
  if (wide)
    return (
      <div className="wtray" data-testid="week-tray" data-day={day} data-count={tasks.length}>
        {list}
      </div>
    )
  return (
    <div className="wtray narrow" data-testid="week-tray" data-day={day} data-count={tasks.length}>
      <button type="button" className="wtray-chip" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="week-tray-chip">
        {tasks.length} to place
      </button>
      {open && <div className="wtray-pop">{list}</div>}
    </div>
  )
}

/** A desktop day header: the day, "Xh planned · Yh free", all-day items and the tray — one `plan` drop target. */
function WeekHead({ day, sel, items, events, planned, cats, settings, wide, today }: { day: string; sel: boolean; items: Item[]; events: EventItem[]; planned: Task[]; cats: Map<string, Category>; settings: SettingsData; wide: boolean; today: string }) {
  const set = useUI((s) => s.set)
  const { setNodeRef, isOver } = useDroppable({ id: `wplan:${day}`, data: { type: 'plan', day } })
  const stats = useMemo(
    () => dayStats(items, settings.day_start, settings.day_end, null, events.filter((e) => !e.event.all_day).map((e) => ({ start: e.start, end: e.end }))),
    [items, events, settings.day_start, settings.day_end],
  )
  const allDay = [
    ...items.filter((i) => i.task.all_day).map((i) => ({ key: i.key, title: i.task.title || 'Untitled', color: cats.get(i.task.category_id ?? '')?.color ?? 'errand', evt: false })),
    ...events.filter((e) => e.event.all_day).map((e) => ({ key: e.key, title: e.event.title || 'Event', color: 'errand', evt: true })),
  ]
  return (
    <div ref={setNodeRef} className={`whcell ${isOver ? 'over' : ''} ${day === today ? 'today' : ''}`} data-testid="week-head" data-day={day}>
      <button type="button" className={`wday ${day === today ? 'today' : ''} ${sel ? 'sel' : ''}`} onClick={() => set({ date: day, view: 'day', mobileTab: 'board' })} data-testid="week-day">
        <b>{shortDay(fromKey(day))}</b>
      </button>
      <span className="whours tnum" data-testid="week-hours" data-planned={stats.planned} data-free={stats.free}>
        <span>{fmtH(stats.planned)} planned</span> <span aria-hidden="true">·</span> <span>{fmtH(stats.free)} free</span>
      </span>
      {allDay.length > 0 && (
        <ul className="wallday" aria-label="All day">
          {allDay.map((a) => (
            <li key={a.key} className={`wad cat-${a.color} ${a.evt ? 'evt' : ''}`} title={a.title} data-testid="week-allday">
              {a.title}
            </li>
          ))}
        </ul>
      )}
      <WeekTray day={day} tasks={planned} wide={wide} cats={cats} today={today} />
    </div>
  )
}

/** The seven spine columns (+ the hour rail). `overview` = the iPhone layout behind the collapsed panel. */
export function Week({ date, cats, settings, overview = false, hidden = false }: { date: string; cats: Map<string, Category>; settings: SettingsData; overview?: boolean; hidden?: boolean }) {
  const mobile = useIsMobile()
  const start = weekStart(date, settings.week_start)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const items = useItems(days)
  const events = useEvents(days)
  const today = todayKey()
  const now = useNow()
  const planned = usePlannedRange(days[0], days[6], today)

  // column width → readable cards (≥ WEEK_WIDE) or discs; measured, so the iPhone overview gets cards when it is wide
  const [colW, setColW] = useState(0)
  const [grid, setGrid] = useState<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!grid) return
    const read = () => {
      const w = grid.querySelector('.wcol')?.getBoundingClientRect().width ?? 0
      setColW((c) => (Math.abs(c - w) > 0.5 ? w : c))
    }
    read()
    const ro = new ResizeObserver(read)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [grid])
  const wide = colW >= WEEK_WIDE

  // every day's nodes: the wake bookend, that day's timed tasks + timed events by start, the lights-out bookend
  const nodesByDay = useMemo(() => {
    const out: Record<string, WNode[]> = {}
    for (const d of days) {
      const timed = (items?.[d] ?? []).filter((i) => !i.task.all_day && !i.task.deleted_at)
      const evs = (events[d] ?? []).filter((e) => !e.event.all_day)
      const mid: WNode[] = [
        ...timed.map((i) => {
          const c = cats.get(i.task.category_id ?? '')
          return { key: i.key, start: i.start, dur: i.task.duration_min, color: c?.color ?? 'errand', icon: taskIcon(i.task.title, c?.icon, settings.iconOverrides), item: i, title: i.task.title || 'Untitled' }
        }),
        ...evs.map((e) => ({ key: e.key, start: e.start, dur: e.end - e.start, color: 'errand', icon: 'ui-calendar', event: e, title: e.event.title || 'Event' })),
      ].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key))
      out[d] = [
        { key: `wake@${d}`, start: settings.day_start, dur: 1, color: 'accent', icon: 'rest-alarm', title: '', anchor: true },
        ...mid,
        { key: `sleep@${d}`, start: settings.day_end, dur: 1, color: 'errand', icon: 'rest-moon', title: '', anchor: true },
      ]
    }
    return out
  }, [days, items, events, cats, settings.day_start, settings.day_end, settings.iconOverrides])

  // the rail: day_start..day_end rounded out to the hour, widened to any task or event outside it this week
  const { railFrom, railTo } = useMemo(() => {
    let lo = settings.day_start
    let hi = settings.day_end
    for (const d of days)
      for (const n of nodesByDay[d])
        if (!n.anchor) {
          lo = Math.min(lo, n.start)
          hi = Math.max(hi, n.start + n.dur)
        }
    return { railFrom: Math.floor(lo / 60) * 60, railTo: Math.min(1440, Math.ceil(hi / 60) * 60) }
  }, [days, nodesByDay, settings.day_start, settings.day_end])
  // the rail uses the same linear week map (it is identical for every column at this scale)
  const railMap = useMemo(() => buildSegments([], [], settings.day_start, settings.day_end, WEEK_SEG_OPTS), [settings.day_start, settings.day_end])
  const origin = railMap.minToY(railFrom) - PAD_TOP
  const hours = useMemo(() => Array.from({ length: (railTo - railFrom) / 60 + 1 }, (_, i) => railFrom + i * 60), [railFrom, railTo])
  const height = railMap.minToY(railTo) - origin + WEEK_NODE + PAD_TOP
  const isPast = (d: string) => d < today
  const nowIn = now >= railFrom && now <= railTo ? now : null

  return (
    <section className={`week spine-week ${overview ? 'wov' : ''} ${hidden ? 'is-hidden' : ''} ${wide ? 'wide' : ''}`} aria-label="Week" data-testid="week" data-wide={wide || undefined} aria-hidden={hidden || undefined}>
      {!overview && (
        <div className="whead">
          {/* arc 7 slice 3: the pane header's ‹ › step by week here — one set of arrows; the cell keeps the rail column */}
          <div className="wnav" aria-hidden="true" />
          {days.map((d) => (
            <WeekHead key={d} day={d} sel={d === date} items={items?.[d] ?? []} events={events[d] ?? []} planned={planned?.[d] ?? []} cats={cats} settings={settings} wide={wide} today={today} />
          ))}
        </div>
      )}
      <div className="wbody">
        <div className="wgrid" style={{ height }} ref={setGrid}>
          <div className="wrail" aria-hidden="true">
            {hours.map((m) => (
              <div key={m} className="hour" style={{ top: railMap.minToY(m) - origin }} data-testid="week-hour" data-min={m}>
                <HourLabel min={m} clock24={settings.clock24} />
              </div>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn key={d} day={d} nodes={nodesByDay[d]} settings={settings} origin={origin} past={isPast(d)} mobile={mobile} hidden={hidden} wide={wide} colW={colW} now={d === today ? nowIn : null} />
          ))}
        </div>
      </div>
    </section>
  )
}
