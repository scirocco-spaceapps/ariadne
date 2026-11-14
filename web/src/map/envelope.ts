// Return envelope (Y5): from where can the astronaut still get back to the safe haven in time?
// cost_to_home (A4) gives minutes to the haven per 2 m cell (NaN = unreachable). With budget B and
// reserve R from aoi.model (a copy of model/params.json) and t minutes elapsed:
//   margin = (B - t) - R - cost_to_home
// safe when margin >= R, tight from 0 to R, out below 0 or unreachable. No threshold is hard-coded
// here: both come from the model.

import { useEffect, useMemo, useState } from 'react'
import type { WsAlert, WsState } from '../lib/types'
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
const ALPHA: Record<MarginClass, number> = { safe: 75, tight: 130, out: 150 }

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

// Storm alert (Y6): the envelope becomes "home before the storm". With minutes_left before the storm,
// a cell is amber when its way home is not longer than that, dimmed otherwise (no reserve here).

export type EnvelopeMode = { kind: 'normal' } | { kind: 'storm'; minutes_left: number }

/** Minutes until the storm arrives (contracts/ws-messages.md): lead_min - (t_min - since_t), >= 0. */
export function minutesToStorm(lead_min: number, since_t: number, t_min: number): number {
  return Math.max(0, lead_min - (t_min - since_t))
}

/** minutesToStorm for an alert object. */
export function timeToStorm(alert: WsAlert, t_min: number): number {
  return minutesToStorm(alert.lead_min, alert.since_t, t_min)
}

/** Storm mode while the state carries an alert, normal otherwise (and without a state). */
export function envelopeMode(state: WsState | null): EnvelopeMode {
  return state?.alert ? { kind: 'storm', minutes_left: timeToStorm(state.alert, state.t_min) } : { kind: 'normal' }
}

/** cost_to_home (minutes to the haven) at [x, y]; null outside the AOI or where the way home is blocked. */
export function costToHomeAt(cost: CostRaster, x: number, y: number): number | null {
  const cell = worldToRaster([x, y], cost.size_m, cost.px_m)
  if (!cell) return null
  const c = cost.data[cell.row * cost.cols + cell.col]
  return Number.isFinite(c) ? c : null
}

/** Minutes to spare walking home from [x, y] before the storm; null outside the AOI or blocked. */
export function stormMarginAt(cost: CostRaster, x: number, y: number, minutes_left: number): number | null {
  const cell = worldToRaster([x, y], cost.size_m, cost.px_m)
  if (!cell) return null
  const c = cost.data[cell.row * cost.cols + cell.col]
  return Number.isFinite(c) ? minutes_left - c : null
}

/** RGBA pixels of the storm envelope: amber where home is reachable before the storm, dim elsewhere. */
export function stormPixels(
  cost: CostRaster,
  minutes_left: number,
): { data: Uint8ClampedArray<ArrayBuffer>; width: number; height: number } {
  const n = cost.cols * cost.rows
  const data = new Uint8ClampedArray(n * 4)
  const home = [...rgb(ENVELOPE_COLORS.tight), ALPHA.tight]
  const out = [...rgb(ENVELOPE_COLORS.out), ALPHA.out]
  for (let i = 0; i < n; i++) {
    const k = cost.data[i] <= minutes_left ? home : out // NaN -> out
    const o = i * 4
    data[o] = k[0]
    data[o + 1] = k[1]
    data[o + 2] = k[2]
    data[o + 3] = k[3]
  }
  return { data, width: cost.cols, height: cost.rows }
}

/** Pixels for the current mode: the normal envelope at t, or the storm envelope. */
export function envelopeImage(cost: CostRaster, model: EnvelopeModel, t: number, mode: EnvelopeMode) {
  return mode.kind === 'storm' ? stormPixels(cost, mode.minutes_left) : envelopePixels(cost, model, t)
}

/**
 * The envelope drawn on a fresh offscreen canvas, for a deck.gl BitmapLayer: the normal envelope at t,
 * or the storm envelope when stormMinutesLeft is a number.
 */
export function envelopeCanvas(
  cost: CostRaster,
  model: EnvelopeModel,
  t: number,
  stormMinutesLeft: number | null = null,
): HTMLCanvasElement | null {
  const mode: EnvelopeMode =
    stormMinutesLeft === null ? { kind: 'normal' } : { kind: 'storm', minutes_left: stormMinutesLeft }
  const { data, width, height } = envelopeImage(cost, model, t, mode)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.putImageData(new ImageData(data, width, height), 0, 0)
  return canvas
}

/** Share of AOI cells (0-1) whose way home is finite and at most maxCost minutes. */
export function shareWithin(cost: CostRaster, maxCost: number): number {
  const n = cost.data.length
  if (n === 0) return 0
  let k = 0
  for (let i = 0; i < n; i++) if (cost.data[i] <= maxCost) k++ // NaN compares false
  return k / n
}

/**
 * Share of the AOI from which home is still reachable, by the same rule the envelope draws:
 * margin >= 0 (cost <= B - t - R) normally, or home before the storm (cost <= minutes left).
 */
export function reachableShare(
  cost: CostRaster,
  model: EnvelopeModel,
  t: number,
  stormMinutesLeft: number | null = null,
): number {
  const maxCost = stormMinutesLeft === null ? model.budget_min - t - model.reserve_min : stormMinutesLeft
  return shareWithin(cost, maxCost)
}

/** Cost-to-home rasters in aoi.json: the terrain model, or the flat-ground variant (A7, optional). */
export type CostKey = 'cost_to_home' | 'cost_to_home_flat'

const cache = new Map<string, Promise<CostRaster>>()

/** Fetches a cost raster once per URL (little-endian float32, row-major, row 0 north). */
export function loadCostRaster(source: AssetSource, key: CostKey = 'cost_to_home'): Promise<CostRaster> {
  const ref = source.aoi.rasters[key]
  if (!ref) return Promise.reject(new Error(`aoi.json has no rasters.${key}`))
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

/**
 * A cost raster of a source; null while loading, when it cannot be loaded, or when an optional one
 * (the flat variant) is not on the asset host.
 */
export function useCostToHome(source: AssetSource, key: CostKey = 'cost_to_home'): CostRaster | null {
  const [cost, setCost] = useState<{ source: AssetSource; key: CostKey; raster: CostRaster } | null>(null)
  useEffect(() => {
    let cancelled = false
    const ref = source.aoi.rasters[key]
    const present = !ref ? Promise.resolve(false) : ref.optional ? source.exists(ref.file) : Promise.resolve(true)
    present
      .then((ok) => (ok ? loadCostRaster(source, key) : null))
      .then(
        (raster) => !cancelled && setCost(raster ? { source, key, raster } : null),
        () => !cancelled && setCost(null),
      )
    return () => {
      cancelled = true
    }
  }, [source, key])
  return cost && cost.source === source && cost.key === key ? cost.raster : null
}

/**
 * The envelope image for the map, redrawn only when one of its inputs changes. tq is the time floored
 * to 0.5 min; stormKey is the time to the storm floored the same way, or -1 without an alert.
 */
export function useEnvelopeImage(
  cost: CostRaster | null,
  budget_min: number,
  reserve_min: number,
  tq: number,
  stormKey: number,
): { image: HTMLCanvasElement } | null {
  return useMemo(() => {
    if (!cost) return null
    const image = envelopeCanvas(cost, { budget_min, reserve_min }, tq, stormKey >= 0 ? stormKey : null)
    return image ? { image } : null
  }, [cost, budget_min, reserve_min, tq, stormKey])
}

/**
 * Reachable share of the site for the terrain and the flat-ground rasters (Y9), recomputed only when
 * an input changes. Null unless both rasters are given. stormKey as in useEnvelopeImage.
 */
export function useReachableShares(
  terrain: CostRaster | null,
  flat: CostRaster | null,
  budget_min: number,
  reserve_min: number,
  tq: number,
  stormKey: number,
): { terrain: number; flat: number } | null {
  return useMemo(() => {
    if (!terrain || !flat) return null
    const model = { budget_min, reserve_min }
    const storm = stormKey >= 0 ? stormKey : null
    return { terrain: reachableShare(terrain, model, tq, storm), flat: reachableShare(flat, model, tq, storm) }
  }, [terrain, flat, budget_min, reserve_min, tq, stormKey])
}
