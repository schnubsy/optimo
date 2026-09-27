import { memo, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Category } from '../data/types'
import { Icon } from '../icons/Icon'
import { fmtClock, fmtDur } from '../lib/time'
import type { Item } from './items'
import { resizeTo } from './layout'

export interface BlockProps {
  item: Item
  col: number
  cols: number
  hourPx: number
  cat?: Category
  cats?: Category[]
  /** the chip glyph: override → keyword map → category glyph (src/quickadd/suggest.ts taskIcon) */
  icon?: string
  selected: boolean
  running: boolean
  late: boolean
  dim: boolean
  clock24: boolean
  snap: number
  now: number
  onSelect: (item: Item) => void
  onToggle: (item: Item) => void
  onResize: (item: Item, duration: number) => void
  onCategory?: (item: Item, categoryId: string) => void
}

const PRI = ['', 'P3', 'P2', 'P1']
const PRIO_RING = ['', 'low', 'med', 'high']
/** Pills under 27 min are "short" (spec §4): smaller chip, time at the right end. */
export const SHORT_MIN = 27
/** Pill height from its duration: max(32px, duration × px-per-min − 4px). */
export const pillHeight = (dur: number, hourPx: number) => Math.max(32, (dur / 60) * hourPx - 4)

export const Block = memo(function Block(p: BlockProps) {
  const { item, hourPx } = p
  const t = item.task
  const [liveDur, setLiveDur] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  // the live value lives in a ref: pointerup can arrive before React renders the last move (a quick flick),
  // so the commit must never read it from render state
  const resize = useRef<{ y: number; dur: number; live: number } | null>(null)
  const press = useRef<number | null>(null)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `blk:${item.key}`,
    data: { type: 'block', item },
  })
  useEffect(() => () => clearTimeout(press.current ?? undefined), [])

  const dur = liveDur ?? t.duration_min
  const top = (item.start / 60) * hourPx
  const height = pillHeight(dur, hourPx)
  const short = dur < SHORT_MIN
  const thin = height < 44
  const done = !!t.completed_at
  const color = p.cat?.color ?? 'errand'
  const timeText = `${fmtClock(item.start, p.clock24)}${short || thin ? '' : `–${fmtClock(item.start + dur, p.clock24)}`}`
  const pri = PRI[t.priority]
  const title = t.title || 'Untitled'
  const gap = 4
  const left = p.cols > 1 ? `calc(${(100 * p.col) / p.cols}% + ${p.col ? gap / 2 : 0}px)` : undefined
  const width = p.cols > 1 ? `calc(${100 / p.cols}% - ${gap / 2}px)` : undefined
  const elapsed = p.running ? Math.min(1, Math.max(0, (p.now - item.start) / Math.max(1, t.duration_min))) : 0

  function onResizeDown(e: RPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* synthetic or already-released pointer */
    }
    resize.current = { y: e.clientY, dur: t.duration_min, live: t.duration_min }
    setLiveDur(t.duration_min)
  }
  function onResizeMove(e: RPointerEvent<HTMLDivElement>) {
    const r = resize.current
    if (!r) return
    r.live = resizeTo(r.dur, e.clientY - r.y, hourPx, p.snap)
    setLiveDur(r.live)
  }
  // commit on release only (never per move): duration from the release point, through the repo layer
  function onResizeUp(e: RPointerEvent<HTMLDivElement>) {
    const r = resize.current
    if (!r) return
    resize.current = null
    const final = e.type === 'pointercancel' ? r.live : resizeTo(r.dur, e.clientY - r.y, hourPx, p.snap)
    setLiveDur(null)
    p.onResize(item, final)
  }
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()
  function onKey(e: RKeyboardEvent) {
    // X on a focused pill toggles done (the window-level map would otherwise act on the selection too)
    if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.stopPropagation()
      e.preventDefault()
      p.onToggle(item)
    }
  }

  return (
    <article
      ref={setNodeRef}
      className={`pill blk cat-${color} ${done ? 'done' : ''} ${short ? 'short' : ''} ${thin ? 'is-thin' : ''} ${p.selected ? 'sel' : ''} ${p.running ? 'run' : ''} ${isDragging ? 'grab' : ''} ${p.dim ? 'dim' : ''} ${p.late ? 'late' : ''} ${picking ? 'picking' : ''}`}
      style={{
        top,
        height,
        left,
        width,
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
      {p.running && <span className="elapsed" style={{ width: `${elapsed * 100}%` }} aria-hidden="true" />}
      <button
        type="button"
        className={`chip ${PRIO_RING[t.priority] ? `prio-${PRIO_RING[t.priority]}` : ''}`}
        aria-label={`Mark ${title} done`}
        aria-pressed={done}
        onClick={(e) => {
          e.stopPropagation()
          if (press.current === -1) {
            press.current = null
            return
          }
          p.onToggle(item)
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
          // long-press (500 ms) opens the category picker instead of completing
          press.current = window.setTimeout(() => {
            press.current = -1
            setPicking(true)
          }, 500)
        }}
        onPointerUp={() => press.current !== -1 && clearTimeout(press.current ?? undefined)}
        onPointerLeave={() => press.current !== -1 && clearTimeout(press.current ?? undefined)}
        onContextMenu={(e) => {
          e.preventDefault()
          setPicking(true)
        }}
        onMouseDown={stop}
        onTouchStart={stop}
        data-testid="chip"
      >
        <Icon name={done ? 'ui-check' : (p.icon ?? p.cat?.icon ?? 'work-document')} size={short ? 13 : 18} />
      </button>
      <button
        type="button"
        className="blk-main"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable block"
        aria-label={`${title}, ${timeText}${pri ? `, ${pri}` : ''}${done ? ', done' : ''}${p.running ? ', now' : ''}${p.late ? ', late' : ''}${item.occurrence ? ', repeats' : ''}`}
        aria-pressed={p.selected}
        onClick={(e) => {
          e.stopPropagation()
          p.onSelect(item)
        }}
      >
        <span className="title">
          <span className="tt">{title}</span>
          {item.occurrence && <span className="rep" aria-hidden="true">↻</span>}
        </span>
        <span className="time tnum" aria-hidden="true">
          <b>{timeText}{(short || thin) && pri ? ` ${pri}` : ''}</b>
          {!short && height >= 52 && <span className="sub">{[p.cat?.name, pri, t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : ''].filter(Boolean).join(' · ')}</span>}
        </span>
      </button>
      {picking && (
        <div className="catpick" role="dialog" aria-label={`Category for ${title}`} onPointerDown={stop} onMouseDown={stop}>
          {(p.cats ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              className={`catpick-chip cat-${c.color}`}
              aria-label={c.name}
              aria-pressed={c.id === t.category_id}
              onClick={(e) => {
                e.stopPropagation()
                setPicking(false)
                p.onCategory?.(item, c.id)
              }}
            >
              <Icon name={c.icon} size={16} />
            </button>
          ))}
          <button type="button" className="catpick-x" aria-label="Close" onClick={(e) => { e.stopPropagation(); setPicking(false) }}>
            <Icon name="ui-close" size={14} />
          </button>
        </div>
      )}
      {(p.selected || liveDur !== null) && !done && (
        <div
          className="handle"
          role="slider"
          aria-label={`Resize “${title}”`}
          aria-valuemin={5}
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
