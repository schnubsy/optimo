import { Icon } from './Icon'
import { CHROME, ICON_GROUPS } from './set'

/** The whole in-repo glyph set, grouped as in the picker — the icon-sheet evidence and the design review. */
export function IconSheet() {
  const count = ICON_GROUPS.reduce((a, g) => a + g.icons.length, 0) + Object.keys(CHROME).length
  return (
    <section className="page" aria-labelledby="icons-h" tabIndex={0}>
      <h2 id="icons-h">Icon set ({count})</h2>
      {[...ICON_GROUPS, { id: 'chrome', label: 'Chrome', icons: Object.keys(CHROME) }].map((g) => (
        <div key={g.id}>
          <h3 className="icon-group">{g.label}</h3>
          <ul className="icon-sheet" data-testid="icon-sheet">
            {g.icons.map((n) => (
              <li key={n}>
                <span className="icon-chip cat-meet" aria-hidden="true"><Icon name={n} size={18} /></span>
                {/* arc 6: chrome glyphs are also checked at the tab size (24) and the meta size (13) */}
                {g.id === 'chrome' && (
                  <span className="icon-sizes" aria-hidden="true" data-testid="icon-sizes">
                    <Icon name={n} size={24} />
                    <Icon name={n} size={13} />
                  </span>
                )}
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
