// Proposed blocks drawn on the day's timeline as ghosts: dashed, tinted by category, each with its "why".
// Decorative (aria-hidden) — the proposal list beside them is the accessible, interactive surface.
import type { AiBlock, Category } from '../data/types'
import { fmtClock } from '../lib/time'

export interface Ghost {
  i: number
  block: AiBlock
  start: number // minutes after the plan day's local midnight
  end: number
  on: boolean // ticked to accept
  clash: string | null // title of an existing task/event it overlaps
}

export function PlanGhosts({ ghosts, hourPx, clock24, cats }: { ghosts: Ghost[]; hourPx: number; clock24: boolean; cats: Map<string, Category> }) {
  return (
    <>
      {ghosts.map((g) => {
        const h = Math.max(((g.end - g.start) / 60) * hourPx, 22)
        const color = cats.get(g.block.category_id ?? '')?.color ?? 'errand'
        return (
          <div
            key={g.i}
            className={`plan-ghost cat-${color} ${g.on ? '' : 'off'} ${g.clash ? 'clash' : ''} ${h < 40 ? 'short' : ''}`}
            style={{ transform: `translateY(${(g.start / 60) * hourPx}px)`, height: h }}
            aria-hidden="true"
            data-testid="plan-ghost"
          >
            <b>{g.block.title}</b>
            <span className="tnum">
              {fmtClock(g.start, clock24)}–{fmtClock(g.end % 1440, clock24)}
            </span>
            {h >= 56 && g.block.why && <em>{g.block.why}</em>}
          </div>
        )
      })}
    </>
  )
}
