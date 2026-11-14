import { describe, expect, it } from 'vitest'
import { fitZoom, metresPerPixel, niceScaleBar } from './scale'

describe('metresPerPixel', () => {
  it('halves with every zoom step', () => {
    expect(metresPerPixel(0)).toBe(1)
    expect(metresPerPixel(1)).toBe(0.5)
    expect(metresPerPixel(-2)).toBe(4)
  })
})

describe('niceScaleBar', () => {
  it('picks the longest 1-2-5 length that fits', () => {
    expect(niceScaleBar(1, 120)).toMatchObject({ metres: 100, px: 100, label: '100 m' })
    expect(niceScaleBar(0.5, 120)).toMatchObject({ metres: 50, px: 100, label: '50 m' })
    expect(niceScaleBar(4, 120)).toMatchObject({ metres: 200, px: 50, label: '200 m' })
    expect(niceScaleBar(20, 120)).toMatchObject({ metres: 2000, label: '2 km' })
    expect(niceScaleBar(0.005, 120)).toMatchObject({ metres: 0.5, label: '50 cm' })
  })

  it('never draws a bar longer than maxPx', () => {
    for (const mpp of [0.013, 0.37, 1.9, 7.3, 33]) {
      expect(niceScaleBar(mpp, 120).px).toBeLessThanOrEqual(120)
    }
  })
})

describe('fitZoom', () => {
  it('fits the limiting side of the AOI', () => {
    // 500 x 400 m into 1048 x 448 px with 24 px padding: height limits, 400 px for 400 m
    expect(fitZoom(1048, 448, [500, 400])).toBeCloseTo(0)
    // tall viewport: width limits, 250 px for 500 m
    expect(fitZoom(298, 2000, [500, 400])).toBeCloseTo(-1)
  })
})
