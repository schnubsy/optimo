import { memo } from 'react'
import { Icon } from '../icons/Icon'
import { fmtClock, fmtGap } from '../lib/time'

/** Free time worth an "Add Task" pill under the sentence (mockups 01 / 08). */
export const PILL_MIN = 90

// Our own copy (originality rule): long gaps get an open-ended line, short ones a nudge. `{d}` is the duration.
const LONG = ['Room to make something of {d}.', '{d} wide open.', 'A clear run of {d}.']
const SHORT = ['{d} free — want to fit something in?', '{d} between things.']

/** Stable per day + gap so the line never flickers between renders. */
export function gapCopy(day: string, from: number, len: number): [string, string] {
  const pool = len >= PILL_MIN ? LONG : SHORT
  let h = 0
  for (const ch of `${day}:${from}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const line = pool[h % pool.length]
  const i = line.indexOf('{d}')
  return [line.slice(0, i), line.slice(i + 3)]
}

const spoken = (min: number) => {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return h ? `${h} hour${h > 1 ? 's' : ''}${m ? ` ${m} minutes` : ''}` : `${m} minutes`
}

/**
 * Free time on the spine: a timer glyph + a sentence with the duration in the accent, and for ≥ 90 min an
 * "Add Task" pill. The sentence and the pill both open the wizard at the gap start for min(default, gap).
 * The gap box itself takes no pointer events, so a press-drag across it paints (arc 5a) on the timeline beneath.
 */
export const Gap = memo(function Gap({ day, from, to, y, h, clock24, onAdd }: { day: string; from: number; to: number; y: number; h: number; clock24: boolean; onAdd: (start: number) => void }) {
  const len = to - from
  const [pre, post] = gapCopy(day, from, len)
  const pill = len >= PILL_MIN && h >= 84
  const label = `${spoken(len)} free from ${fmtClock(from, clock24)}, add a task`
  return (
    <div className={`gap ${pill ? 'has-pill' : ''}`} style={{ top: y, height: h }} data-testid="free-row" data-start={from} data-len={len}>
      {h >= 34 && (
        <div className="gap-in">
          <button type="button" className="gap-say" onClick={() => onAdd(from)} tabIndex={pill ? -1 : 0} aria-label={pill ? undefined : label} aria-hidden={pill || undefined} data-testid={pill ? undefined : 'free-add'}>
            <Icon name="ui-timer" size={20} />
            <span>
              {pre}
              <b className="tnum">{fmtGap(len)}</b>
              {post}
            </span>
          </button>
          {pill && (
            <button type="button" className="gap-pill" onClick={() => onAdd(from)} aria-label={label} data-testid="free-add">
              <Icon name="ui-plus-circle" size={16} />
              Add Task
            </button>
          )}
        </div>
      )}
    </div>
  )
})
