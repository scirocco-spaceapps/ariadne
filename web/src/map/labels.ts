// Label placement (Y9 polish): keep place names from overlapping at the current zoom.
// Labels are placed in priority order (first = most important). Each goes above its marker; if that
// box overlaps a label already placed, it tries below, then right, then left, and keeps the first
// free spot (or above, if none is free).

import type { XY } from './coords'

export type Placement = 'above' | 'below' | 'right' | 'left'
type Box = [number, number, number, number] // x0, y0, x1, y1 in screen pixels (y down)

const ORDER: Placement[] = ['above', 'below', 'right', 'left']

/** Rough width of a label in pixels: average glyph width plus the background padding. */
export function labelWidth(text: string, size: number): number {
  return text.length * size * 0.58 + 8
}

function boxFor(xy: XY, w: number, h: number, ppm: number, offset: number, where: Placement): Box {
  const cx = xy[0] * ppm
  const cy = -xy[1] * ppm // screen y grows downward, world y northward
  switch (where) {
    case 'above':
      return [cx - w / 2, cy - offset - h, cx + w / 2, cy - offset]
    case 'below':
      return [cx - w / 2, cy + offset, cx + w / 2, cy + offset + h]
    case 'right':
      return [cx + offset, cy - h / 2, cx + offset + w, cy + h / 2]
    case 'left':
      return [cx - offset - w, cy - h / 2, cx - offset, cy + h / 2]
  }
}

const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]

/**
 * Placement for each label. ppm = screen pixels per metre at the current zoom; size = font size in
 * pixels; offset = gap between the marker centre and the label in pixels.
 */
export function placeLabels<T extends { xy: XY; name: string }>(
  items: T[],
  ppm: number,
  size: number,
  offset: number,
): (T & { placement: Placement })[] {
  const placed: Box[] = []
  const h = size + 4
  return items.map((item) => {
    const w = labelWidth(item.name, size)
    let choice: Placement = 'above'
    let chosen: Box | null = null
    for (const where of ORDER) {
      const b = boxFor(item.xy, w, h, ppm, offset, where)
      if (!placed.some((p) => overlaps(p, b))) {
        choice = where
        chosen = b
        break
      }
    }
    placed.push(chosen ?? boxFor(item.xy, w, h, ppm, offset, 'above'))
    return { ...item, placement: choice }
  })
}

/** deck.gl TextLayer anchor, baseline and pixel offset for a placement. */
export function placementProps(where: Placement, offset: number) {
  switch (where) {
    case 'above':
      return { anchor: 'middle', baseline: 'bottom', pixelOffset: [0, -offset] } as const
    case 'below':
      return { anchor: 'middle', baseline: 'top', pixelOffset: [0, offset] } as const
    case 'right':
      return { anchor: 'start', baseline: 'center', pixelOffset: [offset, 0] } as const
    case 'left':
      return { anchor: 'end', baseline: 'center', pixelOffset: [-offset, 0] } as const
  }
}
