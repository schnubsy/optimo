import type { ReactElement } from 'react'

// Every glyph is drawn here on a 24 px grid: square caps, mitre joins, 2 px stroke. No third-party icon set.
export const ICONS: Record<string, ReactElement> = {
  dot: <rect x="9" y="9" width="6" height="6" />,
  check: <path d="M5 12l4 4L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  work: <><rect x="4" y="4" width="16" height="16" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  meet: <><rect x="3" y="6" width="8" height="8" /><rect x="13" y="10" width="8" height="8" /></>,
  health: <path d="M3 12h4l2-5 3 10 2-6 1 1h6" />,
  meal: <><rect x="4" y="4" width="16" height="16" /><rect x="9" y="9" width="6" height="6" /></>,
  family: <path d="M4 11l8-7 8 7v9H4z" />,
  errand: <path d="M5 12l4 4L19 6" />,
  learn: <><rect x="4" y="4" width="7" height="16" /><rect x="13" y="4" width="7" height="16" /></>,
  home: <path d="M12 20V8M6 14l6-6 6 6" />,
}
