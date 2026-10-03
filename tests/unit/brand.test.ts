// Snag train 2026-10, slice 12 (Fixes #26): the brand mark must move off the red-squircle/toggle register.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('brand mark', () => {
  const svg = readFileSync('src/icons/brand.svg', 'utf8')

  it('inverts the ground — blush canvas, not a solid coral fill', () => {
    // the old mark filled the full 32x32 with the accent colour; the canvas (blush) must now be dominant
    expect(svg).toMatch(/fill="#fff4f2"/)
    expect(svg.indexOf('#fff4f2')).toBeLessThan(svg.indexOf('#b54c3d')) // blush painted first (the ground)
  })

  it('is not a single pill-with-a-plain-knob (the toggle-switch read)', () => {
    // a toggle reads as exactly one track (pill) + one blank circle; this mark must carry a second pill
    // (the stacked-blocks motif) and the chip must have its own counter-cut, not render as a blank knob
    const pillCount = (svg.match(/<rect/g) ?? []).length
    expect(pillCount).toBeGreaterThanOrEqual(2)
    const circleCount = (svg.match(/<circle/g) ?? []).length
    expect(circleCount).toBeGreaterThanOrEqual(3) // chip + its counter-cut + the sage free-time dot
  })

  it('carries the sage free-time dot as a third colour', () => {
    expect(svg).toMatch(/fill="#547f4b"/)
  })
})
