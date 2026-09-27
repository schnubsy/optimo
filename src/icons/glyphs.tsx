import type { ReactElement } from 'react'

// optimo's own glyph set — drawn here on a 24 px grid: square caps, mitre joins, 2 px stroke, no fills.
// Geometric and blocky to match Switchboard; not traced from, or named after, any third-party icon set.
export const ICONS: Record<string, ReactElement> = {
  // --- system ---
  dot: <rect x="9" y="9" width="6" height="6" />,
  check: <path d="M5 12l4 4L19 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  inbox: <path d="M3 13h5l1 3h6l1-3h5M3 13l3-8h12l3 8v6H3z" />,
  repeat: <path d="M4 11V7h13l-3-3M20 13v4H7l3 3" />,
  clock: <><rect x="4" y="4" width="16" height="16" /><path d="M12 8v4h4" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" /><path d="M4 10h16M8 3v4M16 3v4" /></>,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" />,
  flag: <path d="M6 21V4h11l-2 4 2 4H6" />,
  pin: <><path d="M12 21l-6-8a6 6 0 1 1 12 0z" /><rect x="10" y="8" width="4" height="4" /></>,
  star: <path d="M12 3l2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20l1.4-6.3L3 9.4l6.4-.6z" />,
  focus: <><rect x="4" y="4" width="16" height="16" /><rect x="9" y="9" width="6" height="6" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></>,
  idea: <path d="M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  // --- work & admin ---
  work: <><rect x="4" y="4" width="16" height="16" /><path d="M8 9h8M8 13h8M8 17h5" /></>,
  meet: <><rect x="3" y="6" width="8" height="8" /><rect x="13" y="10" width="8" height="8" /></>,
  laptop: <path d="M5 6h14v9H5zM2 18h20" />,
  code: <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  mail: <><rect x="3" y="5" width="18" height="14" /><path d="M3 6l9 7 9-7" /></>,
  phone: <><rect x="7" y="3" width="10" height="18" /><path d="M11 18h2" /></>,
  chat: <path d="M4 5h16v11h-9l-5 4v-4H4z" />,
  pen: <path d="M4 20l1-5L16 4l4 4L9 19zM13 7l4 4" />,
  chart: <path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" />,
  money: <><rect x="3" y="6" width="18" height="12" /><rect x="10" y="10" width="4" height="4" /><path d="M6 9v6M18 9v6" /></>,
  // --- body & health ---
  health: <path d="M3 12h4l2-5 3 10 2-6 1 1h6" />,
  run: <path d="M13 4h3v3h-3zM8 21l3-6-2-3 4-3 3 4h3M11 15l4 2v4M9 12H5" />,
  gym: <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />,
  bike: <><rect x="2" y="13" width="7" height="7" /><rect x="15" y="13" width="7" height="7" /><path d="M5 16l4-8h5l3 8M12 16L9 8M13 5h3" /></>,
  walk: <path d="M12 3h3v3h-3zM10 21l2-7-3-3 2-4 4 3 3 1M9 11l-3 3" />,
  sleep: <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10zM15 3h4l-4 4h4" />,
  pill: <><rect x="4" y="9" width="16" height="6" transform="rotate(-45 12 12)" /><path d="M9.2 9.2l5.6 5.6" /></>,
  heart: <path d="M12 20L4 12a4.5 4.5 0 0 1 8-5 4.5 4.5 0 0 1 8 5z" />,
  water: <path d="M12 3l6 9a6 6 0 1 1-12 0z" />,
  // --- home & life ---
  home: <path d="M4 11l8-7 8 7v9H4zM10 20v-6h4v6" />,
  family: <><rect x="4" y="5" width="5" height="5" /><rect x="15" y="5" width="5" height="5" /><rect x="10" y="12" width="4" height="4" /><path d="M3 20v-6h7M21 20v-6h-7M9 20v-2h6v2" /></>,
  kid: <><rect x="9" y="3" width="6" height="6" /><path d="M6 12h12M12 9v7M9 21l3-5 3 5" /></>,
  pet: <><rect x="5" y="4" width="4" height="4" /><rect x="15" y="4" width="4" height="4" /><rect x="2" y="10" width="4" height="4" /><rect x="18" y="10" width="4" height="4" /><path d="M8 20l2-6h4l2 6z" /></>,
  plant: <path d="M12 21V11M12 11C12 6 8 4 4 4c0 5 3 7 8 7zM12 14c0-4 3-6 8-6 0 4-3 6-8 6zM8 21h8" />,
  clean: <path d="M12 3v6M9 9h6l2 12H7zM4 5l2 2M20 5l-2 2" />,
  tools: <path d="M14 4a4 4 0 0 0 5 5l-9 9-3 1 1-3 9-9M5 5l4 4" />,
  gift: <><rect x="4" y="9" width="16" height="11" /><path d="M3 9h18M12 9v11M12 9L8 5M12 9l4-4" /></>,
  // --- food & errands ---
  meal: <><rect x="4" y="4" width="16" height="16" /><rect x="9" y="9" width="6" height="6" /></>,
  coffee: <path d="M4 8h12v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM16 10h3v4h-3M8 3v2M12 3v2" />,
  cook: <path d="M4 11h16M6 11v8h12v-8M9 7h6M12 4v3M20 11l2-2" />,
  errand: <path d="M5 8h14l-1 12H6zM9 8V5h6v3" />,
  cart: <path d="M2 4h3l3 11h11l2-8H6M9 20h2M16 20h2" />,
  car: <path d="M3 16v-5l3-5h12l3 5v5zM3 11h18M6 16v3M18 16v3M7 13h2M15 13h2" />,
  train: <path d="M6 3h12v13H6zM6 10h12M9 16l-2 5M15 16l2 5M9 13h1M14 13h1" />,
  plane: <path d="M2 13l8-1 5-8h2l-2 8 5 1 2-3h2l-1 5 1 5h-2l-2-3-5 1 2 8h-2l-5-8-8-1z" transform="scale(.9) translate(1 -1)" />,
  // --- learning & leisure ---
  learn: <><rect x="4" y="4" width="7" height="16" /><rect x="13" y="4" width="7" height="16" /></>,
  read: <path d="M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3zM21 5h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7z" />,
  music: <path d="M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3h3M20 16a3 3 0 1 1-3-3h3" />,
  game: <path d="M3 9h18v8H3zM7 11v4M5 13h4M15 12h1M18 14h1" />,
  film: <><rect x="3" y="5" width="18" height="14" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  camera: <><path d="M3 7h5l2-3h4l2 3h5v13H3z" /><rect x="9" y="10" width="6" height="6" /></>,
  sun: <><rect x="8" y="8" width="8" height="8" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2" /></>,
}

export const ICON_NAMES = Object.keys(ICONS)

/** Keywords that map an `@hint` or a category name to a glyph. */
export const ICON_ALIASES: Record<string, string> = {
  gym: 'gym', workout: 'gym', lift: 'gym', run: 'run', jog: 'run', walk: 'walk', bike: 'bike', cycle: 'bike',
  sleep: 'sleep', bed: 'sleep', meds: 'pill', pill: 'pill', doctor: 'health', dentist: 'health',
  lunch: 'meal', dinner: 'meal', breakfast: 'meal', eat: 'meal', coffee: 'coffee', cook: 'cook',
  shop: 'cart', groceries: 'cart', buy: 'cart', car: 'car', drive: 'car', train: 'train', flight: 'plane', fly: 'plane', travel: 'plane',
  call: 'phone', email: 'mail', mail: 'mail', write: 'pen', code: 'code', meeting: 'meet', meet: 'meet',
  read: 'read', book: 'read', study: 'learn', learn: 'learn', music: 'music', guitar: 'music', piano: 'music',
  film: 'film', movie: 'film', game: 'game', photo: 'camera', plants: 'plant', garden: 'plant', clean: 'clean', fix: 'tools',
  kids: 'kid', kid: 'kid', dog: 'pet', cat: 'pet', pet: 'pet', gift: 'gift', birthday: 'gift', pay: 'money', bills: 'money', focus: 'focus',
}

export function resolveIcon(hint: string | null | undefined): string | null {
  if (!hint) return null
  const h = hint.toLowerCase()
  return ICONS[h] ? h : (ICON_ALIASES[h] ?? null)
}
