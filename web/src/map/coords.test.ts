import { describe, expect, it } from 'vitest'
import { cellIndex, inAoi, rasterShape, rasterToWorld, worldToRaster, type SizeM } from './coords'

// Same extent and pixel sizes as contracts/fixtures/aoi.json.
const SIZE: SizeM = [500, 400]
const PX = [0.5, 1, 2, 4]

describe('rasterShape', () => {
  it('matches the fixture raster sizes', () => {
    expect(rasterShape(SIZE, 0.5)).toEqual({ cols: 1000, rows: 800 })
    expect(rasterShape(SIZE, 2)).toEqual({ cols: 250, rows: 200 })
    expect(rasterShape(SIZE, 4)).toEqual({ cols: 125, rows: 100 })
  })
})

describe.each(PX)('worldToRaster / rasterToWorld at %s m per pixel', (px) => {
  const { cols, rows } = rasterShape(SIZE, px)

  it('puts the north-west corner in row 0, col 0', () => {
    expect(worldToRaster([0, 400], SIZE, px)).toEqual({ row: 0, col: 0 })
  })

  it('puts the south-east corner in the last row and column', () => {
    expect(worldToRaster([500, 0], SIZE, px)).toEqual({ row: rows - 1, col: cols - 1 })
  })

  it('flips rows: north is row 0, south is the last row', () => {
    const nearNorth = worldToRaster([250, 400 - px / 2], SIZE, px)
    const nearSouth = worldToRaster([250, px / 2], SIZE, px)
    expect(nearNorth?.row).toBe(0)
    expect(nearSouth?.row).toBe(rows - 1)
    // moving north (y up) never increases the row
    expect(worldToRaster([250, 300], SIZE, px)!.row).toBeLessThan(worldToRaster([250, 100], SIZE, px)!.row)
  })

  it('returns the pixel centre and maps it back to the same cell', () => {
    for (const [row, col] of [
      [0, 0],
      [0, cols - 1],
      [rows - 1, 0],
      [rows - 1, cols - 1],
      [Math.floor(rows / 3), Math.floor(cols / 2)],
    ]) {
      const [x, y] = rasterToWorld(row, col, SIZE, px)
      expect(x).toBeCloseTo((col + 0.5) * px)
      expect(y).toBeCloseTo(400 - (row + 0.5) * px)
      expect(worldToRaster([x, y], SIZE, px)).toEqual({ row, col })
    }
  })

  it('returns null outside the AOI', () => {
    expect(worldToRaster([-0.01, 10], SIZE, px)).toBeNull()
    expect(worldToRaster([10, 400.01], SIZE, px)).toBeNull()
    expect(worldToRaster([500.01, 10], SIZE, px)).toBeNull()
    expect(worldToRaster([10, -0.01], SIZE, px)).toBeNull()
  })
})

describe('cellIndex and inAoi', () => {
  it('indexes row-major from the north-west corner', () => {
    expect(cellIndex({ row: 0, col: 0 }, SIZE, 2)).toBe(0)
    expect(cellIndex({ row: 0, col: 249 }, SIZE, 2)).toBe(249)
    expect(cellIndex({ row: 1, col: 0 }, SIZE, 2)).toBe(250)
    expect(cellIndex({ row: 199, col: 249 }, SIZE, 2)).toBe(250 * 200 - 1)
  })

  it('includes the edges', () => {
    expect(inAoi([0, 0], SIZE)).toBe(true)
    expect(inAoi([500, 400], SIZE)).toBe(true)
    expect(inAoi([500.1, 400], SIZE)).toBe(false)
  })
})
