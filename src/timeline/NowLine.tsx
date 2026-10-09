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

/** Now marker (decision 6): a 10 px accent disc on the spine and a 2 px hairline to the right edge, at the map's y. */
export function NowLine({ now, y, clock24 }: { now: number; y: number; clock24: boolean }) {
  return (
    <div className="now" style={{ transform: `translateY(${y}px)` }} data-testid="now-line" data-min={now}>
      <span className="sr-only">Now {fmtClock(now, clock24)}</span>
    </div>
  )
}
