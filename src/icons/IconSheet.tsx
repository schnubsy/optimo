import { Icon } from './Icon'
import { ICON_NAMES } from './glyphs'

/** Renders the whole in-repo glyph set — used for the icon-sheet evidence and the design review. */
export function IconSheet() {
  return (
    <section className="page" aria-labelledby="icons-h" tabIndex={0}>
      <h2 id="icons-h">Icon set ({ICON_NAMES.length})</h2>
      <ul className="icon-sheet" data-testid="icon-sheet">
        {ICON_NAMES.map((n) => (
          <li key={n}>
            <Icon name={n} size={24} />
            <span className="mono">{n}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
