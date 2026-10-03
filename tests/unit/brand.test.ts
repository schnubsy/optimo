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
    expect(circleCount).toBeGreaterThanOrEqual(2) // chip + the sage free-time dot
    expect(svg).toMatch(/<path[^>]*stroke="#ffffff"/) // the chip's white glyph counter-cut (tick)
  })

  it('carries the sage free-time dot as a third colour', () => {
    expect(svg).toMatch(/fill="#547f4b"/)
  })

  // ai-planner slice 3 (Fixes #30): the chip sits *inside* the top pill, like the product's block — not a knob.
  describe('#30 chip inside the pill', () => {
    const num = (tag: string, a: string) => Number(new RegExp(`\\b${a}="([\\d.]+)"`).exec(tag)?.[1])
    const circles = [...svg.matchAll(/<circle[^>]*>/g)].map((m) => m[0])
    const pills = [...svg.matchAll(/<rect[^>]*fill="#b54c3d"[^>]*>/g)].map((m) => m[0])
    const box = (r: string) => ({ x: num(r, 'x'), y: num(r, 'y'), w: num(r, 'width'), h: num(r, 'height'), rx: num(r, 'rx') })
    const [top, bottom] = pills.map(box).sort((a, b) => a.y - b.y)

    it('has no white disc', () => {
      expect(circles.some((c) => /fill="#(fff|ffffff)"/i.test(c))).toBe(false)
    })

    it('chip disc #8f3a2e r=3.2 lies wholly inside the top pill (incl. its rounded end)', () => {
      const chip = circles.find((c) => c.includes('fill="#8f3a2e"'))!
      expect(chip).toBeTruthy()
      const cx = num(chip, 'cx'), cy = num(chip, 'cy'), r = num(chip, 'r')
      expect(r).toBeCloseTo(3.2)
      // vertical extent within the pill height
      expect(cy - r).toBeGreaterThanOrEqual(top.y)
      expect(cy + r).toBeLessThanOrEqual(top.y + top.h)
      // inside the left semicircular cap: distance from cap centre + r <= cap radius
      const capX = top.x + top.rx, capY = top.y + top.h / 2
      expect(Math.hypot(cx - capX, cy - capY) + r).toBeLessThanOrEqual(top.rx + 1e-9)
      expect(cx - r).toBeCloseTo(top.x + 1.5) // inset 1.5 from the pill's left end
    })

    it('leaves a gap of at least 1.5 between the two pills, inside the 32 canvas', () => {
      expect(bottom.y - (top.y + top.h)).toBeGreaterThanOrEqual(1.5)
      expect(bottom.y + bottom.h).toBeLessThanOrEqual(32)
    })

    it('keeps the sage dot', () => {
      expect(circles.some((c) => c.includes('fill="#547f4b"'))).toBe(true)
    })
  })
})
