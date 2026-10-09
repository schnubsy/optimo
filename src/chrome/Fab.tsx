import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'
import { useUI } from '../state/ui'
import { CaptureSheet } from '../capture/CaptureSheet'

/** Round 58 px accent FAB (iPhone, mockup 01). arc 7 slice 8: opens the one-line capture (Details… → the wizard). */
export function Fab() {
  const open = useUI((s) => s.capture)
  const root = document.querySelector('.app') ?? document.body
  return (
    <>
      <button type="button" className="fab" aria-label="Capture a task" aria-haspopup="dialog" aria-expanded={open} onClick={() => useUI.getState().set({ capture: true })} data-testid="fab">
        <Icon name="ui-plus" size={28} />
      </button>
      {open && createPortal(<CaptureSheet />, root)}
    </>
  )
}
