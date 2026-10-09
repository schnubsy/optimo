import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { fmtClock } from '../lib/time'
import { fmtRange } from './wizardModel'

export interface WheelProps {
  count: number
  index: number
  onIndex: (i: number) => void
  /** accessible name of the listbox */
  label: string
  rowLabel: (i: number) => string
  rowH: number
  idPrefix: string
  className?: string
  testid?: string
  /** what is drawn over the centre row (the accent pill, the hours/min band) — aria-hidden */
  overlay?: ReactNode
  /** rows skipped by PageUp / PageDown */
  page?: number
}

/**
 * A scroll-snap picker column. Keyboard: a listbox with aria-activedescendant — ↑/↓ one row, PgUp/PgDn `page` rows,
 * Home/End. Scrolling settles on a row (debounced) and reports it; a value changed from outside scrolls it into place.
 */
export function Wheel({ count, index, onIndex, label, rowLabel, rowH, idPrefix, className, testid, overlay, page = 4 }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef(index)
  const clamp = (i: number) => Math.max(0, Math.min(count - 1, i))
  useLayoutEffect(() => {
    current.current = index
    const el = ref.current
    if (el && Math.abs(el.scrollTop - index * rowH) > 1) el.scrollTop = index * rowH
  }, [index, rowH])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const onScroll = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = clamp(Math.round(el.scrollTop / rowH))
      if (i !== current.current) onIndex(i)
    }, 90)
  }
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, PageUp: -page, PageDown: page }
    let next: number | null = null
    if (e.key in step) next = clamp(index + step[e.key])
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    if (next === null) return
    e.preventDefault()
    e.stopPropagation()
    if (next !== index) onIndex(next)
  }
  return (
    <div className={`wheel ${className ?? ''}`} style={{ ['--row-h' as string]: `${rowH}px` }}>
      <div
        ref={ref}
        className="wheel-scroll"
        role="listbox"
        tabIndex={0}
        aria-label={label}
        aria-activedescendant={`${idPrefix}-${index}`}
        onScroll={onScroll}
        onKeyDown={onKey}
        data-testid={testid}
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} id={`${idPrefix}-${i}`} role="option" aria-selected={i === index} className="wheel-row tnum" onClick={() => onIndex(i)}>
            {rowLabel(i)}
          </div>
        ))}
      </div>
      {overlay && (
        <div className="wheel-overlay" aria-hidden="true">
          {overlay}
        </div>
      )}
    </div>
  )
}

const STEP = 15
const ROWS = (24 * 60) / STEP

/** ② Time: 15-minute rows across the day; the centre row is the accent pill reading the whole range. */
export function TimeWheel({ start, duration, clock24, onChange }: { start: number; duration: number; clock24: boolean; onChange: (start: number) => void }) {
  const index = Math.max(0, Math.min(ROWS - 1, Math.round(start / STEP)))
  const range = fmtRange(start, duration, clock24)
  return (
    <Wheel
      className="time-wheel"
      count={ROWS}
      index={index}
      onIndex={(i) => onChange(i * STEP)}
      label={`Start time, ${range}`}
      // mockups 02: rows above the pill are earlier starts; rows below continue from the end of the booked span
      rowLabel={(i) => fmtClock(i * STEP + (i > index ? duration : 0), clock24)}
      rowH={32}
      idPrefix="tw"
      testid="time-wheel"
      overlay={
        <span className="time-pill tnum" data-testid="time-pill">
          {range}
        </span>
      }
    />
  )
}
