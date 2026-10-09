// Paint a block (arc 5a slice 4): the ghost the gesture draws into, and the keyboard "empty slot" cursor.
import { forwardRef, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent, type RefObject } from 'react'
import { fmtClock, MIN_PER_DAY } from '../lib/time'
import { paintSpan } from './paint'
import { drawGhost, hideGhost, rangeLabel, showGhost } from './usePaint'
import type { SegmentMap } from './segments'

/**
 * The paint ghost. Always mounted and hidden; usePaint / PaintSlot write its transform and label directly
 * (translateY for the start, scaleY on a one-hour fill for the length, a translated end cap), so painting never
 * re-renders React.
 */
export const PaintGhost = forwardRef<HTMLDivElement>(function PaintGhost(_p, ref) {
  return (
    <div className="paint" ref={ref} aria-hidden="true" data-testid="paint-ghost">
      <div className="paint-cue">
        <i className="paint-fill" />
        <i className="paint-cap" />
        <i className="paint-cap paint-end" />
        <b className="paint-label tnum" />
      </div>
    </div>
  )
})

/**
 * Keyboard path: a focusable slot cursor on the timeline. ↑/↓ move it by the snap step; Enter starts a block there,
 * ↑/↓ then move its end, Enter creates it, Esc cancels. Keys are handled here and stopped, so the window keyboard map
 * (move/resize the selection, Enter to edit) never sees them while the slot has focus.
 */
export function PaintSlot({ map, snap, clock24, startAt, ghostRef, busy, onCommit }: {
  map: SegmentMap
  snap: number
  clock24: boolean
  /** where the cursor lands when the slot takes focus (minutes) */
  startAt: () => number
  ghostRef: RefObject<HTMLDivElement | null>
  /** title of whatever already occupies a minute, or null if it is free */
  busy: (min: number) => string | null
  onCommit: (start: number, len: number) => void
}) {
  const [cursor, setCursor] = useState<number | null>(null)
  const [paint, setPaint] = useState<{ anchor: number; cur: number } | null>(null)
  const [say, setSay] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const at = cursor ?? 0
  const span = paint ? paintSpan(paint.anchor, paint.cur, snap) : null
  const taken = busy(at)
  const slotText = taken ? `${fmtClock(at, clock24)}, taken by ${taken}` : `Empty slot ${fmtClock(at, clock24)}`

  // the ghost mirrors the keyboard span (same DOM writes as the pointer gesture)
  useEffect(() => {
    const g = ghostRef.current
    if (!g) return
    if (span) {
      drawGhost(g, span, map, clock24)
      showGhost(g)
    } else hideGhost(g)
  }, [span?.start, span?.end, map, clock24, ghostRef]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the cursor (or the painted end) in view
  useEffect(() => {
    if (cursor !== null) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [cursor, paint?.cur])

  function move(d: number) {
    if (paint) {
      const cur = Math.min(MIN_PER_DAY, Math.max(0, paint.cur + d))
      setPaint({ ...paint, cur })
      setSay(`New block ${rangeLabel(paintSpan(paint.anchor, cur, snap), clock24)}`)
      return
    }
    const next = Math.min(MIN_PER_DAY - snap, Math.max(0, at + d))
    setCursor(next)
    const t = busy(next)
    setSay(t ? `${fmtClock(next, clock24)}, taken by ${t}` : `Empty slot ${fmtClock(next, clock24)}`)
  }
  function onKey(e: RKeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      move(e.key === 'ArrowUp' ? -snap : snap)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      if (!paint) {
        setPaint({ anchor: at, cur: at + snap })
        setSay(`New block ${rangeLabel(paintSpan(at, at + snap, snap), clock24)}. Arrow keys set the end, Enter creates, Escape cancels`)
        return
      }
      const s = paintSpan(paint.anchor, paint.cur, snap)
      setPaint(null)
      setCursor(s.end >= MIN_PER_DAY ? MIN_PER_DAY - snap : s.end)
      setSay(`Created ${rangeLabel(s, clock24)}`)
      onCommit(s.start, s.end - s.start)
    } else if (e.key === 'Escape' && paint) {
      e.preventDefault()
      e.stopPropagation()
      setPaint(null)
      setSay('Cancelled')
    }
  }

  const y = paint && span ? map.minToY(span.end) : map.minToY(at)
  const slotH = Math.max(4, map.minToY(at + snap) - map.minToY(at))
  return (
    <>
      <div
        ref={ref}
        className={`tl-slot ${paint ? 'painting' : ''}`}
        role="button"
        tabIndex={0}
        aria-label={paint && span ? `New block ${rangeLabel(span, clock24)}` : slotText}
        aria-describedby="tl-slot-help"
        style={{ transform: `translate3d(0, ${y}px, 0)`, height: slotH }}
        onFocus={() => {
          if (cursor === null) {
            const s = Math.min(MIN_PER_DAY - snap, Math.max(0, Math.round(startAt() / snap) * snap))
            setCursor(s)
          }
        }}
        onBlur={() => setPaint(null)}
        onKeyDown={onKey}
        data-testid="empty-slot"
        data-min={at}
      >
        <b className="tl-slot-time tnum" aria-hidden="true">{fmtClock(at, clock24)}</b>
      </div>
      <span id="tl-slot-help" className="sr-only">Up and down arrows move. Enter starts a new block here.</span>
      <span className="sr-only" aria-live="polite" data-testid="slot-live">{say}</span>
    </>
  )
}
