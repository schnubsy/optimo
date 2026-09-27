import { memo } from 'react'
import { fmtClock } from '../lib/time'

export const HourRail = memo(function HourRail({ hourPx, dayStart, dayEnd, clock24 }: { hourPx: number; dayStart: number; dayEnd: number; clock24: boolean }) {
  const hours = Array.from({ length: 25 }, (_, h) => h)
  return (
    <div className="rail" aria-hidden="true">
      <div className="oob" style={{ top: 0, height: (dayStart / 60) * hourPx }} />
      <div className="oob" style={{ top: (dayEnd / 60) * hourPx, height: ((1440 - dayEnd) / 60) * hourPx }} />
      {hours.map((h) => (
        <div key={h} className="hour" style={{ top: h * hourPx }}>
          {h < 24 && <b>{fmtClock(h * 60, clock24)}</b>}
        </div>
      ))}
      {hours.slice(0, 24).map((h) =>
        [1, 2, 3].map((q) => <div key={`${h}-${q}`} className="tick" style={{ top: h * hourPx + (q * hourPx) / 4 }} />),
      )}
    </div>
  )
})
