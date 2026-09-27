import { fmtClock, fmtDur } from '../lib/time'
import type { FreeRow as Row } from './layout'

export function FreeRow({ row, hourPx, clock24, onAdd }: { row: Row; hourPx: number; clock24: boolean; onAdd: (start: number) => void }) {
  const h = (row.len / 60) * hourPx
  return (
    <button
      type="button"
      className={`free ${h < 20 ? 'thin' : ''}`}
      style={{ top: (row.start / 60) * hourPx + 1, height: Math.max(8, h - 2) }}
      onClick={(e) => {
        e.stopPropagation()
        // create at the tapped time inside the gap (15-min grid), not just the gap start
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top
        const off = e.clientY ? Math.floor(((y / hourPx) * 60) / 15) * 15 : 0
        onAdd(row.start + Math.min(Math.max(0, off), Math.max(0, row.len - 15)))
      }}
      aria-label={`Free ${fmtDur(row.len)} from ${fmtClock(row.start, clock24)}, add a task`}
      data-testid="free-row"
    >
      <span className="mono">free {fmtDur(row.len)}</span>
      {h >= 20 && <span className="plus" aria-hidden="true">+</span>}
    </button>
  )
}
