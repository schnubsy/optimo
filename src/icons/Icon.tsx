import { ICONS } from './glyphs'

/** Original 24 px line glyphs, drawn in-repo (docs/spec.md §6). Unknown names fall back to `dot`. */
export function Icon({ name, size = 14, className, title }: { name: string; size?: number; className?: string; title?: string }) {
  const body = ICONS[name] ?? ICONS.dot
  return (
    <svg
      className={`ic ${className ?? ''}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {body}
    </svg>
  )
}
