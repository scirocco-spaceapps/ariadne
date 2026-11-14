// Elevation over EVA time: the route response has no profile, so sample the DEM (dem_4m.f32)
// along each leg's path and spread the vertices over the leg's walk interval by distance.
import { assetUrl } from '../lib/assets'
import type { Aoi, RouteResponse } from '../lib/types'
import { cellIndex, rasterShape, worldToRaster, type XY } from '../map'

export interface Dem {
  data: Float32Array
  size_m: [number, number]
  px_m: number
}

export interface ElevPoint {
  t: number
  z: number
}

/** Wraps raw .f32 bytes; null when the length does not match the AOI at the DEM's pixel size. */
export function demFromBuffer(buf: ArrayBuffer, aoi: Aoi): Dem | null {
  const px_m = aoi.rasters.dem.px_m
  const { cols, rows } = rasterShape(aoi.size_m, px_m)
  if (buf.byteLength !== cols * rows * 4) return null
  // .f32 is little-endian float32 (root CLAUDE.md); every browser we target is little-endian.
  return { data: new Float32Array(buf), size_m: aoi.size_m, px_m }
}

/** Fetches the AOI's DEM; null when the file is missing, fails, or has the wrong size. */
export async function loadDem(aoi: Aoi, demo: boolean, signal?: AbortSignal): Promise<Dem | null> {
  try {
    const res = await fetch(assetUrl(aoi, aoi.rasters.dem.file, demo), { signal })
    if (!res.ok) return null
    return demFromBuffer(await res.arrayBuffer(), aoi)
  } catch {
    return null
  }
}

/** DEM value at a world point, or null outside the AOI or on a NaN cell. */
export function sampleDem(dem: Dem, xy: XY): number | null {
  const cell = worldToRaster(xy, dem.size_m, dem.px_m)
  if (!cell) return null
  const z = dem.data[cellIndex(cell, dem.size_m, dem.px_m)]
  return Number.isFinite(z) ? z : null
}

/**
 * Elevation against EVA minutes for the whole route. Walk items: each path vertex at its share of
 * the leg's length within [t0, t1]. Dwell items: the last elevation held from t0 to t1.
 */
export function elevationSeries(route: RouteResponse, dem: Dem): ElevPoint[] {
  const out: ElevPoint[] = []
  for (const item of route.timeline) {
    if (item.kind === 'walk' && item.leg !== undefined) {
      const path = route.legs[item.leg]?.path ?? []
      const cum = [0]
      for (let i = 1; i < path.length; i++) {
        cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
      }
      const total = cum[cum.length - 1] || 1
      path.forEach((xy, i) => {
        const z = sampleDem(dem, xy as XY)
        if (z !== null) out.push({ t: item.t0_min + (item.t1_min - item.t0_min) * (cum[i] / total), z })
      })
    } else if (item.kind === 'dwell' && out.length > 0) {
      const z = out[out.length - 1].z
      out.push({ t: item.t0_min, z }, { t: item.t1_min, z })
    }
  }
  return out
}
