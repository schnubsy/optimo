import { createElement, type FC } from 'react'
import { Icon } from './Icon'
import { ACTIVITY, CHROME, type IconName } from './set'

export { ICON_GROUPS, LEGACY, resolveIcon, type ActivityName, type ChromeName, type IconName } from './set'
export { Icon } from './Icon'

export const ICON_NAMES = [...Object.keys(ACTIVITY), ...Object.keys(CHROME)] as IconName[]

/** Every glyph as a component: `<ICONS['food-coffee'] size={18} />`. */
export const ICONS = Object.fromEntries(
  ICON_NAMES.map((n) => {
    const C: FC<{ size?: number; filled?: boolean }> = (p) => createElement(Icon, { name: n, ...p })
    C.displayName = `Icon(${n})`
    return [n, C]
  }),
) as Record<IconName, FC<{ size?: number; filled?: boolean }>>
