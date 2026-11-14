// Return envelope (Y5): from where can the astronaut still get back to the safe haven in time?
// cost_to_home (A4) gives minutes to the haven per 2 m cell (NaN = unreachable). With budget B and
// reserve R from aoi.model (a copy of model/params.json) and t minutes elapsed:
//   margin = (B - t) - R - cost_to_home
// safe when margin >= R, tight from 0 to R, out below 0 or unreachable. No threshold is hard-coded
// here: both come from the model.

import { useEffect, useState } from 'react'
import type { AssetSource } from './assets'
import { rasterShape, worldToRaster, type SizeM } from './coords'

export type CostRaster = { data: Float32Array; cols: number; rows: number; px_m: number; size_m: SizeM }
export type EnvelopeModel = { budget_min: number; reserve_min: number }
export type MarginClass = 'safe' | 'tight' | 'out'

/** Colours from the visual brief: --safe, --warn, and --bg to dim where the way home is too long. */
export const ENVELOPE_COLORS: Record<MarginClass, string> = {
  safe: '#46c58b',
  tight: '#f2a93b',
  out: '#0a1114',
}
/** Alpha of each class over the imagery (0-255). */
const ALPHA: Record<MarginClass, number> = { safe: 55, tight: 110, out: 150 }

/** Class boundaries in minutes of margin, both taken from the model. */
export function envelopeThresholds(model: EnvelopeModel): { safe_min: number; tight_min: number } {
  return { safe_min: model.reserve_min, tight_min: 0 }
}

/** safe: margin >= reserve; tight: 0 <= margin < reserve; out: below 0, or null (cannot get back). */
export function marginClass(margin: number | null, model: EnvelopeModel): MarginClass {
  if (margin === null || !Number.isFinite(margin)) return 'out'
  const { safe_min, tight_min } = envelopeThresholds(model)
  if (margin >= safe_min) return 'safe'
  return margin >= tight_min ? 'tight' : 'out'
}

/** Minutes of margin for walking home from [x, y] at time t; null outside the AOI or unreachable. */
export function marginAt(cost: CostRaster, model: EnvelopeModel, x: number, y: number, t: number): number | null {
  const cell = worldToRaster([x, y], cost.size_m, cost.px_m)
  if (!cell) return null
  const c = cost.data[cell.row * cost.cols + cell.col]
  if (!Number.isFinite(c)) return null
  return model.budget_min - t - model.reserve_min - c
}

/** marginAt bound to one raster and model: (x, y, t) => minutes or null. For the cuff (N4). */
export function makeMarginAt(cost: CostRaster, model: EnvelopeModel): (x: number, y: number, t: number) => number | null {
  return (x, y, t) => marginAt(cost, model, x, y, t)
}

/** Time steps at which the envelope is redrawn: floor to 0.5 min. */
export function quantizeT(t: number): number {
  return Math.floor(Math.max(0, t) * 2) / 2
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

/** RGBA pixels of the envelope at time t, one per raster cell, row 0 = north edge. */
export function envelopePixels(
  cost: CostRaster,
  model: EnvelopeModel,
  t: number,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const n = cost.cols * cost.rows
  const data = new Uint8ClampedArray(n * 4)
  const colour = {
    safe: [...rgb(ENVELOPE_COLORS.safe), ALPHA.safe],
    tight: [...rgb(ENVELOPE_COLORS.tight), ALPHA.tight],
    out: [...rgb(ENVELOPE_COLORS.out), ALPHA.out],
  }
  // margin >= R  <=>  cost <= B - t - 2R;   margin >= 0  <=>  cost <= B - t - R
  const { safe_min, tight_min } = envelopeThresholds(model)
  const room = model.budget_min - t - model.reserve_min
  const safeMax = room - safe_min
  const tightMax = room - tight_min
  for (let i = 0; i < n; i++) {
    const c = cost.data[i]
    const k = !(c <= tightMax) ? colour.out : c <= safeMax ? colour.safe : colour.tight // NaN -> out
    const o = i * 4
    data[o] = k[0]
    data[o + 1] = k[1]
    data[o + 2] = k[2]
    data[o + 3] = k[3]
  }
  return { data, width: cost.cols, height: cost.rows }
}

/** The envelope at time t drawn on a fresh offscreen canvas, for a deck.gl BitmapLayer. */
export function envelopeCanvas(cost: CostRaster, model: EnvelopeModel, t: number): HTMLCanvasElement | null {
  const { data, width, height } = envelopePixels(cost, model, t)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(new ImageData(data, width, height), 0, 0)
  return canvas
}

const cache = new Map<string, Promise<CostRaster>>()

/** Fetches rasters.cost_to_home once per URL (little-endian float32, row-major, row 0 north). */
export function loadCostRaster(source: AssetSource): Promise<CostRaster> {
  const ref = source.aoi.rasters.cost_to_home
  const url = source.url(ref.file)
  let p = cache.get(url)
  if (!p) {
    p = (async () => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${ref.file}: HTTP ${res.status}`)
      const data = new Float32Array(await res.arrayBuffer())
      const size_m: SizeM = [source.aoi.size_m[0], source.aoi.size_m[1]]
      const { cols, rows } = rasterShape(size_m, ref.px_m)
      if (data.length !== cols * rows) {
        throw new Error(`${ref.file}: ${data.length} values, expected ${cols} x ${rows}`)
      }
      return { data, cols, rows, px_m: ref.px_m, size_m }
    })()
    p.catch(() => cache.delete(url)) // let a later mount retry
    cache.set(url, p)
  }
  return p
}

/** The cost-to-home raster of a source; null while loading or when it cannot be loaded. */
export function useCostToHome(source: AssetSource): CostRaster | null {
  const [cost, setCost] = useState<{ source: AssetSource; raster: CostRaster } | null>(null)
  useEffect(() => {
    let cancelled = false
    loadCostRaster(source).then(
      (raster) => !cancelled && setCost({ source, raster }),
      () => !cancelled && setCost(null),
    )
    return () => {
      cancelled = true
    }
  }, [source])
  return cost && cost.source === source ? cost.raster : null
}
