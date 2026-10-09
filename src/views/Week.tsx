// Week = seven spine columns (arc 6 slice 4, mockup 10). iPhone: the overview behind the collapsed day panel;
// desktop: the Week view under the segmented control. Each column lays its nodes out with its OWN segment map
// (segments.ts, linear: 0.6 px/min = 36 px/h, no compression) — the only minute↔pixel conversion — and registers it in
// `weekMaps` so Planner's drop-on-a-day maths converts with the same map.
import { memo, useEffect, useMemo, type CSSProperties } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Category, SettingsData } from '../data/types'
import { addDays, fromKey, shortDay, todayKey, weekStart } from '../lib/time'
import { useIsMobile } from '../lib/useMedia'
import { useUI } from '../state/ui'
import { useItems, type Item } from '../timeline/items'
import { buildSegments, type SegmentMap } from '../timeline/segments'
import { Icon } from '../icons/Icon'
import { taskIcon } from '../quickadd/suggest'
import '../chrome/panel.css'

/** The week column map: 36 px per hour, linear, with the two bookends (arc 6 RULE: one map). */
export const WEEK_SEG_OPTS = { minPx: 0.6, compress: false, rowMin: 0, padTop: 0, anchors: true } as const
/** Week node: a 48 px disc, or a 48-wide capsule when the duration is taller than that at 36 px/h. */
export const WEEK_NODE = 48
/** Room above the first hour so the first label / disc are not flush with the top. */
const PAD_TOP = 12

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

interface WNode {
  key: string
  start: number
  dur: number
  color: string
  icon: string
  item?: Item
  title: string
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

const WeekNode = memo(function WeekNode({ n, top, past, mobile, day }: { n: WNode; top: number; past: boolean; mobile: boolean; day: string }) {
  const set = useUI((s) => s.set)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `wblk:${n.key}`, data: { type: 'block', item: n.item }, disabled: !n.item })
  const h = Math.max(WEEK_NODE, n.dur * WEEK_SEG_OPTS.minPx)
  const style: CSSProperties = { top, height: h, transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }
  const cls = `wnode cat-${n.color} ${h > WEEK_NODE ? 'capsule' : ''} ${past ? 'past' : ''} ${n.item?.task.completed_at ? 'done' : ''} ${isDragging ? 'grab' : ''}`
  if (!n.item)
    return (
      <span className={cls} style={style} data-testid="week-node" data-past={past || undefined} aria-hidden="true">
        <Icon name={n.icon} size={24} />
      </span>
    )
  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable task"
      aria-label={`${n.title}, ${LONG.format(fromKey(day))}`}
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
      data-past={past || undefined}
    >
      <Icon name={n.item.task.completed_at ? 'ui-check' : n.icon} size={24} />
      <span className="sr-only">{n.title}</span>
    </button>
  )
})

function DayColumn({ day, nodes, settings, origin, past, mobile, hidden }: { day: string; nodes: WNode[]; settings: SettingsData; origin: number; past: boolean; mobile: boolean; hidden?: boolean }) {
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
  const y = (min: number) => map.minToY(min) - off
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const centre = (n: WNode) => y(n.start) + Math.max(WEEK_NODE, n.dur * WEEK_SEG_OPTS.minPx) / 2
  const spineTop = centre(first)
  const spineH = Math.max(0, centre(last) - spineTop)
  const spineBg = past ? `linear-gradient(to bottom, ${pastColor(first.color)}, ${pastColor(last.color)})` : undefined
  const open = () => set(mobile ? { date: day, panel: 'day' } : { date: day, view: 'day' })
  return (
    <div className={`wcol ${isOver ? 'over' : ''} ${day === todayKey() ? 'today' : ''}`} ref={setNodeRef} data-testid="week-col" data-day={day}>
      <button type="button" className="wcol-open" aria-label={`${LONG.format(fromKey(day))}, open the day`} onClick={open} data-testid="week-col-open" data-day={day} />
      <i className="wspine" style={{ top: spineTop, height: spineH, background: spineBg }} data-testid="week-spine" aria-hidden="true" />
      {nodes.map((n) => (
        <WeekNode key={n.key} n={n} top={y(n.start)} past={past} mobile={mobile} day={day} />
      ))}
    </div>
  )
}

/** The seven spine columns (+ the hour rail). `overview` = the iPhone layout behind the collapsed panel. */
export function Week({ date, cats, settings, overview = false, hidden = false }: { date: string; cats: Map<string, Category>; settings: SettingsData; overview?: boolean; hidden?: boolean }) {
  const set = useUI((s) => s.set)
  const mobile = useIsMobile()
  const start = weekStart(date, settings.week_start)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start])
  const items = useItems(days)
  const today = todayKey()

  // every day's nodes: the wake bookend, that day's timed tasks by start, the lights-out bookend
  const nodesByDay = useMemo(() => {
    const out: Record<string, WNode[]> = {}
    for (const d of days) {
      const timed = (items?.[d] ?? []).filter((i) => !i.task.all_day && !i.task.deleted_at).sort((a, b) => a.start - b.start)
      out[d] = [
        { key: `wake@${d}`, start: settings.day_start, dur: 1, color: 'accent', icon: 'rest-alarm', title: '' },
        ...timed.map((i) => {
          const c = cats.get(i.task.category_id ?? '')
          return { key: i.key, start: i.start, dur: i.task.duration_min, color: c?.color ?? 'errand', icon: taskIcon(i.task.title, c?.icon, settings.iconOverrides), item: i, title: i.task.title || 'Untitled' }
        }),
        { key: `sleep@${d}`, start: settings.day_end, dur: 1, color: 'errand', icon: 'rest-moon', title: '' },
      ]
    }
    return out
  }, [days, items, cats, settings.day_start, settings.day_end, settings.iconOverrides])

  // the rail: day_start..day_end rounded out to the hour, widened to any task outside it this week
  const { railFrom, railTo } = useMemo(() => {
    let lo = settings.day_start
    let hi = settings.day_end
    for (const d of days) for (const n of nodesByDay[d]) if (n.item) {
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

  return (
    <section className={`week spine-week ${overview ? 'wov' : ''} ${hidden ? 'is-hidden' : ''}`} aria-label="Week" data-testid="week" aria-hidden={hidden || undefined}>
      {!overview && (
        <div className="whead">
          {/* arc 7 slice 3: the pane header's ‹ › step by week here — one set of arrows; the cell keeps the rail column */}
          <div className="wnav" aria-hidden="true" />
          {days.map((d) => (
            <button type="button" key={d} className={`wday ${d === today ? 'today' : ''} ${d === date ? 'sel' : ''}`} onClick={() => set({ date: d, view: 'day', mobileTab: 'board' })} data-testid="week-day">
              <b>{shortDay(fromKey(d))}</b>
            </button>
          ))}
        </div>
      )}
      <div className="wbody">
        <div className="wgrid" style={{ height }}>
          <div className="wrail" aria-hidden="true">
            {hours.map((m) => (
              <div key={m} className="hour" style={{ top: railMap.minToY(m) - origin }}>
                <HourLabel min={m} clock24={settings.clock24} />
              </div>
            ))}
          </div>
          {days.map((d) => (
            <DayColumn key={d} day={d} nodes={nodesByDay[d]} settings={settings} origin={origin} past={isPast(d)} mobile={mobile} hidden={hidden} />
          ))}
        </div>
      </div>
    </section>
  )
}
