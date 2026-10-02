import { memo } from 'react'
import { fmtClock } from '../lib/time'

/** #15: the now-pill masks the hour numeral whenever the flag sits within 12 min of that hour mark. */
export function hourNumeralHidden(now: number | null | undefined, hourMin: number): boolean {
  if (now == null) return false
  return Math.abs(now - hourMin) < 12
}

export const HourRail = memo(function HourRail({ hourPx, dayStart, dayEnd, clock24, now }: { hourPx: number; dayStart: number; dayEnd: number; clock24: boolean; now?: number | null }) {
  const hours = Array.from({ length: 25 }, (_, h) => h)
  return (
    <div className="rail" aria-hidden="true">
      <div className="oob" style={{ top: 0, height: (dayStart / 60) * hourPx }} />
      <div className="oob" style={{ top: (dayEnd / 60) * hourPx, height: ((1440 - dayEnd) / 60) * hourPx }} />
      {hours.map((h) => (
        <div key={h} className="hour" style={{ top: h * hourPx }}>
          {h < 24 && (
            <b data-testid="hour-label" data-hour={h} style={hourNumeralHidden(now, h * 60) ? { opacity: 0 } : undefined}>
              {fmtClock(h * 60, clock24)}
            </b>
          )}
        </div>
      ))}
      {hours.slice(0, 24).map((h) =>
        [1, 2, 3].map((q) => <div key={`${h}-${q}`} className="tick" style={{ top: h * hourPx + (q * hourPx) / 4 }} />),
      )}
    </div>
  )
})
