// World <-> raster conversion for the AOI plane.
// World: metres from the AOI south-west corner, x east, y north.
// Raster: north-up, row 0 at the north edge, col 0 at the west edge.

export type XY = [number, number]
export type SizeM = [number, number]
export type Cell = { row: number; col: number }

/** Number of columns and rows of a raster that covers the AOI at px_m metres per pixel. */
export function rasterShape(size_m: SizeM, px_m: number): { cols: number; rows: number } {
  return { cols: Math.round(size_m[0] / px_m), rows: Math.round(size_m[1] / px_m) }
}

/** True when [x, y] lies inside the AOI, edges included. */
export function inAoi([x, y]: XY, size_m: SizeM): boolean {
  return x >= 0 && y >= 0 && x <= size_m[0] && y <= size_m[1]
}

/**
 * Raster cell that contains a world point, or null outside the AOI.
 * The east and south edges belong to the last column and the last row.
 */
export function worldToRaster(xy: XY, size_m: SizeM, px_m: number): Cell | null {
  if (!inAoi(xy, size_m)) return null
  const { cols, rows } = rasterShape(size_m, px_m)
  const col = Math.min(Math.floor(xy[0] / px_m), cols - 1)
  const row = Math.min(Math.floor((size_m[1] - xy[1]) / px_m), rows - 1)
  return { row, col }
}

/** World coordinates of the centre of a raster cell. */
export function rasterToWorld(row: number, col: number, size_m: SizeM, px_m: number): XY {
  return [(col + 0.5) * px_m, size_m[1] - (row + 0.5) * px_m]
}

/** Row-major index of a cell in a flat raster array (e.g. a Float32Array from an .f32 file). */
export function cellIndex({ row, col }: Cell, size_m: SizeM, px_m: number): number {
  return row * rasterShape(size_m, px_m).cols + col
}
