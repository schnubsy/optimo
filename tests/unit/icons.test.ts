import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement } from 'react'
import { ACTIVITY, CHROME, ICON_GROUPS, LEGACY, resolveIcon } from '../../src/icons/set'
import { ICONS, ICON_NAMES } from '../../src/icons'

describe('optimo glyph set', () => {
  it('has the 64 activity + 23 chrome glyphs (spec §6.2, + ui-calendar #18, + 10 arc-6 glyphs)', () => {
    expect(Object.keys(ACTIVITY)).toHaveLength(64)
    expect(Object.keys(CHROME)).toHaveLength(23)
    expect(ICON_GROUPS.flatMap((g) => g.icons).sort()).toEqual(Object.keys(ACTIVITY).sort())
  })
  it.each(ICON_NAMES)('%s renders on a 24×24 viewBox with no external references', (n) => {
    const { container } = render(createElement(ICONS[n], { size: 18 }))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24')
    expect(svg.getAttribute('fill')).toBe('currentColor')
    expect(svg.querySelectorAll('path, rect, circle, ellipse').length).toBeGreaterThan(0)
    const markup = svg.outerHTML
    expect(markup).not.toMatch(/href|url\(|<image|<use|<script|<style|<text/i)
    // every coordinate stays on the 24px canvas
    for (const num of markup.match(/\b\d+(\.\d+)?\b/g) ?? []) expect(Number(num)).toBeLessThanOrEqual(360)
  })
  it('chrome glyphs also render as a 1.75px outline', () => {
    const { container } = render(createElement(ICONS['ui-inbox'], { filled: false }))
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('fill')).toBe('none')
    expect(svg.getAttribute('stroke-width')).toBe('1.75')
  })
  it('pre-arc-2 names keep resolving to a real glyph', () => {
    for (const [old, now] of Object.entries(LEGACY)) {
      expect(resolveIcon(old)).toBe(now)
      expect(ICON_NAMES).toContain(now)
    }
    expect(resolveIcon('no-such-glyph')).toBe('work-document')
  })
  it('#34 meeting-handshake is a tilted clasp with exactly one finger counter-cut (no bow-tie band)', () => {
    const g = ACTIVITY['meeting-handshake']
    expect(g).not.toContain('h6.3l2.2 3h1l2.2-3') // the old two-lobes-and-a-band outline
    expect(g).toContain('rotate(-20')
    const clasp = /<path fill-rule="evenodd"[^>]*d="([^"]+)"/.exec(g)![1]
    expect(clasp.match(/M/g)).toHaveLength(2) // outline + one counter-cut
  })
})
