import { Icon } from '../icons/Icon'
import type { Scope } from '../recurrence/exceptions'
import { REPEAT_OPTIONS, repeatLabel } from '../recurrence/rules'
import { Sheet } from './Sheet'

const SCOPES: [Scope, string][] = [
  ['this', 'This occurrence'],
  ['following', 'This & following'],
  ['all', 'All occurrences'],
]

/**
 * Repeat (mockups 06 chip → sheet): the existing options; for one occurrence of a series the rule is fixed here and the
 * sheet chooses which occurrences a save applies to (this / following / all).
 */
export function RepeatSheet({ repeat, onRepeat, scope, onScope, onClose }: { repeat: string; onRepeat?: (r: string) => void; scope?: Scope; onScope?: (s: Scope) => void; onClose: () => void }) {
  return (
    <Sheet title="Repeat" onClose={onClose} testid="repeat-sheet">
      {onRepeat && (
        <ul className="opt-list" aria-label="Repeat">
          {REPEAT_OPTIONS.map((r) => (
            <li key={r}>
              <button type="button" className="opt-row" aria-pressed={repeat === r} onClick={() => (onRepeat(r), onClose())} data-testid="repeat-option" data-repeat={r}>
                <span>{repeatLabel(r)}</span>
                {repeat === r && <Icon name="ui-check" size={18} />}
              </button>
            </li>
          ))}
        </ul>
      )}
      {scope && onScope && (
        <>
          <h3 className="opt-h">Apply changes to</h3>
          <ul className="opt-list" aria-label="Apply changes to">
            {SCOPES.map(([s, l]) => (
              <li key={s}>
                <button type="button" className="opt-row" aria-pressed={scope === s} onClick={() => onScope(s)} data-testid="scope-option" data-scope={s}>
                  <span>{l}</span>
                  {scope === s && <Icon name="ui-check" size={18} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Sheet>
  )
}
