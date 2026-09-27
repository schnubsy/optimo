import { memo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Category } from '../data/types'
import { Icon } from '../icons/Icon'
import { fmtClock, fmtDur } from '../lib/time'
import type { Item } from './items'
import { snap as snapTo } from './layout'

export interface BlockProps {
  item: Item
  col: number
  cols: number
  hourPx: number
  cat?: Category
  selected: boolean
  running: boolean
  dim: boolean
  clock24: boolean
  snap: number
  now: number
  onSelect: (item: Item) => void
  onToggle: (item: Item) => void
  onResize: (item: Item, duration: number) => void
}

const PRI = ['', 'P3', 'P2', 'P1']

export const Block = memo(function Block(p: BlockProps) {
  const { item, hourPx } = p
  const t = item.task
  const [liveDur, setLiveDur] = useState<number | null>(null)
  const resize = useRef<{ y: number; dur: number } | null>(null)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `blk:${item.key}`,
    data: { type: 'block', item },
  })

  const dur = liveDur ?? t.duration_min
  const top = (item.start / 60) * hourPx
  const height = Math.max(20, (dur / 60) * hourPx - 2)
  const tiny = height < 40
  const done = !!t.completed_at
  const color = p.cat?.color ?? 'errand'
  const timeText = `${fmtClock(item.start, p.clock24)}${tiny ? '' : `–${fmtClock(item.start + dur, p.clock24)}`}`
  const left = p.cols > 1 ? `calc(var(--blk-left) + (100% - var(--blk-left)) * ${p.col} / ${p.cols})` : undefined
  const width = p.cols > 1 ? `calc((100% - var(--blk-left)) / ${p.cols} - 2px)` : undefined
  const progress = p.running ? Math.min(1, Math.max(0, (p.now - item.start) / Math.max(1, t.duration_min))) : 0

  function onResizeDown(e: RPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    resize.current = { y: e.clientY, dur: t.duration_min }
    setLiveDur(t.duration_min)
  }
  function onResizeMove(e: RPointerEvent<HTMLDivElement>) {
    if (!resize.current) return
    const d = resize.current.dur + ((e.clientY - resize.current.y) / hourPx) * 60
    setLiveDur(Math.max(p.snap, snapTo(d, p.snap)))
  }
  function onResizeUp() {
    if (!resize.current) return
    const final = liveDur ?? t.duration_min
    resize.current = null
    setLiveDur(null)
    p.onResize(item, final)
  }
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      className={`blk cat-${color} ${done ? 'done' : ''} ${tiny ? 'tiny' : ''} ${p.selected ? 'sel' : ''} ${p.running ? 'run' : ''} ${isDragging ? 'grab' : ''} ${p.dim ? 'dim' : ''} pri-${t.priority}`}
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
    >
      <button
        type="button"
        className="chk"
        aria-label={done ? `Mark “${t.title}” not done` : `Complete “${t.title}”`}
        aria-pressed={done}
        onClick={(e) => {
          e.stopPropagation()
          p.onToggle(item)
        }}
        onMouseDown={stop}
        onTouchStart={stop}
      >
        <Icon name="check" size={12} />
      </button>
      <button
        type="button"
        className="blk-main"
        {...attributes}
        {...listeners}
        aria-roledescription="draggable block"
        aria-label={`${t.title || 'Untitled'}, ${timeText}${item.occurrence ? ', repeats' : ''}`}
        aria-pressed={p.selected}
        onClick={(e) => {
          e.stopPropagation()
          p.onSelect(item)
        }}
      >
        <span className="t">
          <span className="ic-c">
            <Icon name={p.cat?.icon ?? 'dot'} />
          </span>
          <span className="tt">{t.title || 'Untitled'}</span>
          {item.occurrence && <span className="rep" aria-hidden="true">↻</span>}
        </span>
        {!tiny && (
          <span className="sub">
            {[p.cat?.name, PRI[t.priority], t.subtasks.length ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : ''].filter(Boolean).join(', ')}
          </span>
        )}
      </button>
      <span className="tm mono" aria-hidden="true">
        <b>{timeText}</b>
        {!tiny && fmtDur(dur)}
      </span>
      {p.running && <span className="prog" style={{ transform: `scaleX(${progress})` }} />}
      {(p.selected || liveDur !== null) && !done && (
        <div
          className="handle"
          role="slider"
          aria-label={`Resize “${t.title}”`}
          aria-valuemin={p.snap}
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
          {liveDur !== null && <b className="mono">{fmtDur(liveDur)}</b>}
        </div>
      )}
    </div>
  )
})
