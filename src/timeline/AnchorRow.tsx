import { memo } from 'react'
import { Icon } from '../icons/Icon'
import { fmtClock } from '../lib/time'

/**
 * A day bookend (decision 4): settings.day_start / day_end as an anchor row — alarm (accent) / moon (powder) on the
 * spine, the ↻ mark, the name from settings. Not a task: never synced as one, not draggable. Its ring is a per-day tick
 * kept in settings.bookend_done (plan-mode answer 2026-10-09: the images show it completable). Chip + title open
 * Settings → Day.
 */
export const AnchorRow = memo(function AnchorRow({ which, min, y, h, name, done, clock24, onOpen, onToggle }: {
  which: 'start' | 'end'
  min: number
  y: number
  h: number
  name: string
  done: boolean
  clock24: boolean
  onOpen: () => void
  onToggle: (which: 'start' | 'end') => void
}) {
  const meta = fmtClock(min, clock24)
  return (
    <article className={`node disc anchor ${which === 'start' ? 'cat-accent' : 'cat-errand'} ${done ? 'done' : ''}`} style={{ top: y, height: h, ['--col' as string]: 0, ['--chip-h' as string]: '56px' }} data-testid="anchor" data-which={which} data-start={min}>
      <button type="button" className="node-chip" onClick={(e) => (e.stopPropagation(), onOpen())} aria-label={`${name}, ${meta}, every day. Change in Settings`} data-testid="anchor-chip">
        <Icon name={which === 'start' ? 'rest-alarm' : 'rest-moon'} size={26} />
      </button>
      <button type="button" className="node-text" tabIndex={-1} aria-hidden="true" onClick={(e) => (e.stopPropagation(), onOpen())}>
        <span className="node-meta tnum">
          {meta}
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
