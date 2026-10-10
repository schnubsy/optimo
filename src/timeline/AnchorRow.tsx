import { memo } from 'react'
import { Icon } from '../icons/Icon'
import { fmtClock } from '../lib/time'
import { NODE_PX } from './labels'
import { Lead } from './NodeRow'

/**
 * A day bookend (decision 4): settings.day_start / day_end as an anchor row — alarm (accent) / moon (powder) on the
 * spine, the ↻ mark, the name from settings. Not a task: never synced as one, not draggable. Its ring is a per-day tick
 * kept in settings.bookend_done (plan-mode answer 2026-10-09: the images show it completable). Chip + title open
 * Settings → Day. Inside a cluster (a task runs across the bookend) it takes an overlap column and its own label row,
 * like any node (arc 7 slice 2), so a long task never covers it.
 */
export const AnchorRow = memo(function AnchorRow({ which, min, y, h, col = 0, textCols, labelY, name, done, clock24, onOpen, onToggle }: {
  which: 'start' | 'end'
  min: number
  y: number
  h: number
  col?: number
  textCols?: number
  labelY?: number
  name: string
  done: boolean
  clock24: boolean
  onOpen: () => void
  onToggle: (which: 'start' | 'end') => void
}) {
  const meta = fmtClock(min, clock24)
  return (
    <article
      className={`node disc anchor ${which === 'start' ? 'cat-accent' : 'cat-errand'} ${done ? 'done' : ''}`}
      style={{ top: y, height: h, ['--col' as string]: col, ['--text-cols' as string]: textCols ?? col, ['--label-y' as string]: labelY !== undefined ? `${labelY}px` : undefined, ['--chip-h' as string]: `${NODE_PX}px` }}
      data-testid="anchor"
      data-which={which}
      data-start={min}
    >
      <button type="button" className="node-chip" onClick={(e) => (e.stopPropagation(), onOpen())} aria-label={`${name}, ${meta}, every day. Change in Settings`} data-testid="anchor-chip">
        <Icon name={which === 'start' ? 'rest-alarm' : 'rest-moon'} size={26} />
      </button>
      {labelY !== undefined && <Lead chipTop={(h - NODE_PX) / 2} chipH={NODE_PX} labelY={labelY} />}
      <button type="button" className="node-text" tabIndex={-1} aria-hidden="true" onClick={(e) => (e.stopPropagation(), onOpen())}>
        <span className="node-meta tnum">
          <span className="m-range">{meta}</span>
          <Icon name="ui-repeat" size={14} />
        </span>
        <span className="node-title">{name}</span>
      </button>
      <button type="button" className="ring" aria-label={`Mark ${name} ${done ? 'not done' : 'done'} today`} aria-pressed={done} onClick={(e) => (e.stopPropagation(), onToggle(which))} data-testid="anchor-ring">
        {done && <Icon name="ui-check" size={12} />}
      </button>
    </article>
  )
})
