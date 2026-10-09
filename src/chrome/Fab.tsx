import { Icon } from '../icons/Icon'
import { useUI } from '../state/ui'

/** Round 58 px accent FAB (iPhone, mockup 01): opens the new-task wizard at step ①. */
export function Fab() {
  return (
    <button type="button" className="fab" aria-label="New task" onClick={() => useUI.getState().openWizard('timeline')} data-testid="fab">
      <Icon name="ui-plus" size={28} />
    </button>
  )
}
