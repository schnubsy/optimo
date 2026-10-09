import { memo } from 'react'
import { fmtGutter } from '../lib/time'
import type { RailLabel, SegmentMap } from './segments'

/**
 * The spine (3 px, solid through proportional runs, dashed 10/8 through compressed gaps) from the first row's centre
 * to the last row's, and the gutter times (railLabels). Both read the day's segment map only.
 */
export const Rail = memo(function Rail({ map, labels, clock24 }: { map: SegmentMap; labels: RailLabel[]; clock24: boolean }) {
  const rows = map.segments.filter((s) => s.kind !== 'edge')
  if (!rows.length) return null
  const top = rows[0].y + rows[0].h / 2
  const bottom = rows[rows.length - 1].y + rows[rows.length - 1].h / 2
  return (
    <div className="rail" aria-hidden="true">
      {rows.map((s) => {
        const a = Math.max(top, s.y)
        const b = Math.min(bottom, s.y + s.h)
        if (b <= a) return null
        return <i key={`${s.kind}:${s.from}`} className={`spine ${s.compressed ? 'dashed' : ''}`} style={{ top: a, height: b - a }} data-testid={s.compressed ? 'spine-dashed' : 'spine'} />
      })}
      {labels.map((l) => (
        <b key={`${l.min}:${Math.round(l.y)}`} className="gutter tnum" style={{ top: l.y }} data-testid="hour-label" data-min={l.min}>
          {fmtGutter(l.min, clock24)}
        </b>
      ))}
    </div>
  )
})
