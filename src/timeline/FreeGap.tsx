import { useDroppable } from '@dnd-kit/core'
import { fmtClock } from '../lib/time'
import type { FreeRow as Gap } from './layout'

/** "1h 15m" / "45m" — the free-time label. */
export function freeLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}
/** "1 hour 15" — spoken form for the accessible name. */
const spoken = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} hour${h > 1 ? 's' : ''}${m ? ` ${m}` : ''}` : `${m} minutes`
}

/**
 * Free time between pills (design spec §5.3): a centred dotted rule with a sage label pill at its midpoint and a "+"
 * at the right. Gaps ≥ 10 min render; under 30 min only the "+". The label / "+" create at the gap start; a tap
 * elsewhere in the gap creates at that time (15-min grid, spec §2.2).
 */
export function FreeGap({ gap, day, hourPx, clock24, defaultDuration, onAdd }: { gap: Gap; day: string; hourPx: number; clock24: boolean; defaultDuration: number; onAdd: (start: number, len: number) => void }) {
  const h = (gap.len / 60) * hourPx
  const { setNodeRef, isOver } = useDroppable({ id: `free:${day}:${gap.start}`, data: { type: 'timeline', day } })
  const len = Math.min(gap.len, defaultDuration)
  return (
    <div
      ref={setNodeRef}
      className={`free ${gap.len < 30 ? 'free-short' : ''} ${isOver ? 'over' : ''}`}
      style={{ top: (gap.start / 60) * hourPx, height: h }}
      onClick={(e) => {
        e.stopPropagation()
        const y = e.clientY - e.currentTarget.getBoundingClientRect().top
        const off = e.clientY ? Math.floor(((y / hourPx) * 60) / 15) * 15 : 0
        const at = gap.start + Math.min(Math.max(0, off), Math.max(0, gap.len - 15))
        onAdd(at, Math.min(len, gap.start + gap.len - at))
      }}
      data-testid="free-row"
      data-start={gap.start}
      data-len={gap.len}
    >
      <i className="free-rule" aria-hidden="true" />
      {gap.len >= 30 && (
        // the label is a pointer shortcut for the "+" (same action); keyboard users reach the "+"
        <span
          className="free-label tnum"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation()
            onAdd(gap.start, len)
          }}
        >
          {freeLabel(gap.len)} free
        </span>
      )}
      <button
        type="button"
        className="free-plus"
        onClick={(e) => {
          e.stopPropagation()
          onAdd(gap.start, len)
        }}
        aria-label={`${spoken(gap.len)} free from ${fmtClock(gap.start, clock24)}, add task`}
        data-testid="free-add"
      >
        +
      </button>
    </div>
  )
}
