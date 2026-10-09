import { memo, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Category } from '../data/types'
import { Icon } from '../icons/Icon'
import { deviceZone, fmtClock, fmtDur, fmtDurWords, fmtRange, zoneCity } from '../lib/time'
import type { Item } from './items'
import { MIN_DURATION, snap as snapTo } from './layout'
import type { SegmentMap } from './segments'

/** A task of 30 min or more is a capsule on the spine; shorter ones are a disc (mockups 01 / 08). */
export const CAPSULE_MIN = 30
export const NODE = 56
/** a concurrent task's node sits one column right of the spine */
export const COL_STEP = 64
const PRI = ['', 'P3', 'P2', 'P1']

/** Meta line: `9:00 AM` (disc) or `8:00–9:30 PM (1 hr, 30 min)` (capsule). */
export function nodeMeta(start: number, dur: number, clock24: boolean): string {
  return dur >= CAPSULE_MIN ? `${fmtRange(start, start + dur, clock24)} (${fmtDurWords(dur)})` : fmtClock(start, clock24)
}

/**
 * The time line in whole pieces (arc 7 slice 2): the range, then the duration, which drops out (never clipped
 * mid-word) when the text column is too narrow; in a very narrow column the start time alone stands in for the range
 * (spine.css container query). Discs show the start time only.
 */
export function MetaTime({ start, dur, clock24 }: { start: number; dur: number; clock24: boolean }) {
  if (dur < CAPSULE_MIN) return <span className="m-range">{fmtClock(start, clock24)}</span>
  return (
    <>
      <span className="m-range">{fmtRange(start, start + dur, clock24)}</span>{' '}
      <span className="m-dur">({fmtDurWords(dur)})</span>
      {' '}
      <span className="m-start">{fmtClock(start, clock24)}</span>
    </>
  )
}

/**
 * A label pushed off its own chip (labels.ts) keeps a visible tie to it: a thin elbow from the chip's edge, down (or
 * up) to the label's row, then across to the text. Positions are px from the row top.
 */
export function Lead({ chipTop, chipH, labelY }: { chipTop: number; chipH: number; labelY: number }) {
  const inset = 10
  if (labelY >= chipTop + inset && labelY <= chipTop + chipH - inset) return null
  const down = labelY > chipTop + chipH / 2
  const from = down ? chipTop + chipH : chipTop
  return <i className={`node-lead ${down ? 'down' : 'up'}`} aria-hidden="true" style={{ top: Math.min(from, labelY), height: Math.abs(labelY - from) }} data-testid="node-lead" />
}

export interface NodeRowProps {
  item: Item
  map: SegmentMap
  col: number
  /** the text column starts this many overlap columns right of the base column (labels.ts) */
  textCols?: number
  /** the text + ring's centre, px from the row top (labels.ts); undefined = the row's middle */
  labelY?: number
  cat?: Category
  icon: string
  selected: boolean
  running: boolean
  late: boolean
  clock24: boolean
  snap: number
  onOpen: (item: Item) => void
  onFocusItem: (item: Item) => void
  onToggle: (item: Item) => void
  onResize: (item: Item, duration: number) => void
}

/**
 * One task on the spine. The chip (disc / capsule) is the drag handle and, like the title, opens the editor on a tap
 * (decision 2); the ring at the right completes. Keyboard users select by focusing the chip (the window keyboard map
 * then moves / completes / edits the selection).
 */
export const NodeRow = memo(function NodeRow(p: NodeRowProps) {
  const { item, map } = p
  const t = item.task
  const [liveDur, setLiveDur] = useState<number | null>(null)
  // the live value lives in a ref: pointerup can arrive before React renders the last move (lessons 2026-09-27 [dnd])
  const resize = useRef<{ y: number; end: number; live: number } | null>(null)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `blk:${item.key}`, data: { type: 'block', item } })

  const dur = liveDur ?? t.duration_min
  const top = map.minToY(item.start)
  const rowH = Math.max(1, map.minToY(item.start + t.duration_min) - top)
  const capsule = dur >= CAPSULE_MIN
  // capsule = duration × 2 px/min inside its row (a live resize grows it before the map re-lays the day)
  const chipH = !capsule ? NODE : liveDur !== null ? Math.max(NODE, dur * 2) : Math.max(NODE, Math.min(rowH, dur * 2))
  const done = !!t.completed_at
  const color = p.cat?.color ?? 'errand'
  const title = t.title || 'Untitled'
  const meta = nodeMeta(item.start, dur, p.clock24)
  const repeats = !!item.occurrence || !!t.rrule
  const zoned = !!t.tz && t.tz !== deviceZone()

  // the row's own px-per-minute from the map (2 inside a capsule): the duration follows the finger at the row's scale,
  // not across the next row, which re-lays once the new duration commits
  const scale = Math.max(0.1, rowH / Math.max(1, t.duration_min))
  const durAt = (clientY: number, r: { y: number; end: number }) => Math.max(MIN_DURATION, snapTo(r.end - item.start + (clientY - r.y) / scale, p.snap))
  function onResizeDown(e: RPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic or already released */
    }
    resize.current = { y: e.clientY, end: item.start + t.duration_min, live: t.duration_min }
    setLiveDur(t.duration_min)
  }
  function onResizeMove(e: RPointerEvent<HTMLDivElement>) {
    const r = resize.current
    if (!r) return
    r.live = durAt(e.clientY, r)
    setLiveDur(r.live)
  }
  // commit on release only, recomputed from the release point
  function onResizeUp(e: RPointerEvent<HTMLDivElement>) {
    const r = resize.current
    if (!r) return
    resize.current = null
    const final = e.type === 'pointercancel' ? r.live : durAt(e.clientY, r)
    setLiveDur(null)
    p.onResize(item, final)
  }
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  function onKey(e: RKeyboardEvent) {
    if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation()
      e.preventDefault()
      p.onToggle(item)
    }
  }

  return (
    <article
      ref={setNodeRef}
      className={`node cat-${color} ${capsule ? 'capsule' : 'disc'} ${done ? 'done' : ''} ${p.selected ? 'sel' : ''} ${p.running ? 'run' : ''} ${isDragging ? 'grab' : ''} ${p.late ? 'late' : ''}`}
      style={{
        top,
        height: rowH,
        ['--col' as string]: p.col,
        ['--text-cols' as string]: p.textCols ?? p.col,
        ['--label-y' as string]: p.labelY !== undefined ? `${p.labelY}px` : undefined,
        ['--chip-h' as string]: `${chipH}px`,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      data-testid="block"
      data-id={t.id}
      data-key={item.key}
      data-start={item.start}
      data-duration={dur}
      data-late={p.late || undefined}
      data-done={done || undefined}
      data-selected={p.selected || undefined}
      data-running={p.running || undefined}
      data-dragging={isDragging || undefined}
      onKeyDown={onKey}
    >
      <button
        type="button"
        className="node-chip"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable task"
        aria-label={`${title}, ${meta}${PRI[t.priority] ? `, ${PRI[t.priority]}` : ''}${done ? ', done' : ''}${p.running ? ', now' : ''}${p.late ? ', late' : ''}${repeats ? ', repeats' : ''}. Open`}
        aria-pressed={p.selected}
        onFocus={() => p.onFocusItem(item)}
        onClick={(e) => {
          e.stopPropagation()
          p.onOpen(item)
        }}
        data-testid="chip"
      >
        <Icon name={p.icon} size={26} />
      </button>
      {p.labelY !== undefined && <Lead chipTop={(rowH - chipH) / 2} chipH={chipH} labelY={p.labelY} />}
      <button type="button" className="node-text" tabIndex={-1} aria-hidden="true" onClick={(e) => (e.stopPropagation(), p.onOpen(item))} data-testid="node-title">
        <span className="node-meta tnum">
          <MetaTime start={item.start} dur={dur} clock24={p.clock24} />
          {repeats && <Icon name="ui-repeat" size={14} />}
          {/* a task kept in another zone (db/007): shown converted to this device, marked with the globe */}
          {zoned && <Icon name="ui-globe" size={14} title={`Set in ${zoneCity(t.tz!)} time`} className="node-tz" />}
          {p.late && <span className="node-late">· late</span>}
        </span>
        <span className={`node-title ${t.title ? '' : 'untitled'}`}>{title}</span>
      </button>
      <button
        type="button"
        className="ring"
        aria-label={`Mark ${title} ${done ? 'not done' : 'done'}`}
        aria-pressed={done}
        onClick={(e) => {
          e.stopPropagation()
          p.onToggle(item)
        }}
        onMouseDown={stop}
        onTouchStart={stop}
        data-testid="ring"
      >
        {done && <Icon name="ui-check" size={12} />}
      </button>
      {capsule && (p.selected || liveDur !== null) && !done && (
        <div
          className="node-handle"
          role="slider"
          aria-label={`Resize “${title}”`}
          aria-valuemin={MIN_DURATION}
          aria-valuemax={1440}
          aria-valuenow={dur}
          aria-valuetext={fmtDur(dur)}
          tabIndex={-1}
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          onPointerCancel={onResizeUp}
          onMouseDown={stop}
          onTouchStart={stop}
          data-testid="resize-handle"
        >
          {liveDur !== null && <b className="tnum">{fmtDur(liveDur)}</b>}
        </div>
      )}
    </article>
  )
})
