import { ACTIVITY, CHROME, resolveIcon, type IconName } from './set'

/**
 * optimo's own filled glyphs (src/icons/set.ts). Activity glyphs are filled only; chrome glyphs render filled
 * (active) or as a 1.75px outline of the same silhouette (inactive). Unknown / pre-arc-2 names resolve via LEGACY.
 */
export function Icon({ name, size = 18, filled = true, className, title }: { name: string; size?: number; filled?: boolean; className?: string; title?: string }) {
  const n: IconName = resolveIcon(name)
  const body = (ACTIVITY as Record<string, string>)[n] ?? (CHROME as Record<string, string>)[n]
  const outline = !filled && n in CHROME
  return (
    <svg
      className={`ic ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={outline ? 'none' : 'currentColor'}
      stroke={outline ? 'currentColor' : undefined}
      strokeWidth={outline ? 1.75 : undefined}
      strokeLinejoin={outline ? 'round' : undefined}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      data-icon={n}
    >
      {title && <title>{title}</title>}
      <g dangerouslySetInnerHTML={{ __html: body }} />
    </svg>
  )
}
