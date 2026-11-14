import { describe, expect, it } from 'vitest'
import { labelWidth, placeLabels, placementProps } from './labels'

// At 1 px per metre a 15 px label "Stop A" is about 60 px wide and 19 px tall.
const SIZE = 15
const OFFSET = 16

describe('placeLabels', () => {
  it('keeps labels above their markers when they are far apart', () => {
    const placed = placeLabels(
      [
        { xy: [0, 0] as [number, number], name: 'Stop A' },
        { xy: [500, 0] as [number, number], name: 'Stop B' },
      ],
      1,
      SIZE,
      OFFSET,
    )
    expect(placed.map((p) => p.placement)).toEqual(['above', 'above'])
  })

  it('moves the lower-priority label below when two would overlap', () => {
    const placed = placeLabels(
      [
        { xy: [0, 0] as [number, number], name: 'Safe haven' },
        { xy: [10, 5] as [number, number], name: 'Mount Washburn' },
      ],
      1,
      SIZE,
      OFFSET,
    )
    expect(placed[0].placement).toBe('above') // first = most important, never moved
    expect(placed[1].placement).toBe('below')
  })

  it('tries right and left when above and below are both taken', () => {
    const items = [
      { xy: [0, 0] as [number, number], name: 'Haven' },
      { xy: [0, 0] as [number, number], name: 'Stop 1' },
      { xy: [0, 0] as [number, number], name: 'Stop 2' },
      { xy: [0, 0] as [number, number], name: 'Stop 3' },
    ]
    expect(placeLabels(items, 1, SIZE, OFFSET).map((p) => p.placement)).toEqual(['above', 'below', 'right', 'left'])
  })

  it('spreads out as the view zooms in', () => {
    const items = [
      { xy: [0, 0] as [number, number], name: 'Bright Angel' },
      { xy: [40, 0] as [number, number], name: 'Cheyava Falls' },
    ]
    expect(placeLabels(items, 0.5, SIZE, OFFSET)[1].placement).not.toBe('above') // 20 px apart: clash
    expect(placeLabels(items, 8, SIZE, OFFSET)[1].placement).toBe('above') // 320 px apart: room
  })
})

describe('labelWidth and placementProps', () => {
  it('grows with the text and the font size', () => {
    expect(labelWidth('abcdef', 15)).toBeGreaterThan(labelWidth('abc', 15))
    expect(labelWidth('abc', 20)).toBeGreaterThan(labelWidth('abc', 15))
  })

  it('maps each placement to an anchor, baseline and offset', () => {
    expect(placementProps('above', 16)).toEqual({ anchor: 'middle', baseline: 'bottom', pixelOffset: [0, -16] })
    expect(placementProps('below', 16)).toEqual({ anchor: 'middle', baseline: 'top', pixelOffset: [0, 16] })
    expect(placementProps('right', 16).anchor).toBe('start')
    expect(placementProps('left', 16).anchor).toBe('end')
  })
})
