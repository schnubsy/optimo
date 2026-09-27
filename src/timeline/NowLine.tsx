import { useEffect, useState } from 'react'
import { fmtClock, nowMinutes } from '../lib/time'

/** Tracks live; re-renders every 30 s (docs/spec.md §2.2). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => nowMinutes())
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export function NowLine({ now, hourPx, clock24 }: { now: number; hourPx: number; clock24: boolean }) {
  return (
    <div className="now" style={{ transform: `translateY(${(now / 60) * hourPx}px)` }} data-testid="now-line">
      <b className="mono">{fmtClock(now, clock24)}</b>
    </div>
  )
}
