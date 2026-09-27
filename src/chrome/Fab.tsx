import { Icon } from '../icons/Icon'

/** Round accent FAB (iPhone): opens quick-add as a bottom sheet with the keyboard up. */
export function Fab({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="fab" aria-label="Add task" onClick={onClick} data-testid="fab">
      <Icon name="ui-plus" size={28} />
    </button>
  )
}
