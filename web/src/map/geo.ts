// Small GeoJSON helpers. All coordinates are AOI metres [x, y], not lon/lat (docs/PLAN_CHANGES.md).

import type { GeologyCollection, TargetCollection, TrackCollection, WaypointCollection } from '../lib/types'
import type { XY } from './coords'

export type AnyCollection = TrackCollection | WaypointCollection | TargetCollection | GeologyCollection
export type PointFeature = { xy: XY; properties: Record<string, unknown> }

const isXY = (v: unknown): v is XY =>
  Array.isArray(v) && v.length >= 2 && typeof v[0] === 'number' && typeof v[1] === 'number'

/** Every line of a track collection as a path; MultiLineString parts become separate paths. */
export function linePaths(fc: TrackCollection): XY[][] {
  const paths: XY[][] = []
  for (const f of fc.features) {
    const coords = f.geometry.coordinates as unknown[]
    if (f.geometry.type === 'LineString') {
      paths.push(coords.filter(isXY).map((c) => [c[0], c[1]]))
    } else {
      for (const part of coords) {
        if (Array.isArray(part)) paths.push(part.filter(isXY).map((c) => [c[0], c[1]]))
      }
    }
  }
  return paths.filter((p) => p.length >= 2)
}

/** Point features with their properties (waypoints, targets). */
export function pointFeatures(fc: WaypointCollection | TargetCollection): PointFeature[] {
  return fc.features
    .filter((f) => isXY(f.geometry.coordinates))
    .map((f) => ({
      xy: [f.geometry.coordinates[0], f.geometry.coordinates[1]],
      properties: f.properties as Record<string, unknown>,
    }))
}

/** Label anchor for a polygon feature: mean of its outer ring (good enough for unit labels). */
export function polygonLabelPoint(coordinates: unknown): XY | null {
  // Polygon: [ring, ...]; MultiPolygon: [[ring, ...], ...]. Take the first outer ring.
  let ring: unknown = coordinates
  while (Array.isArray(ring) && Array.isArray(ring[0]) && !isXY(ring[0])) ring = ring[0]
  if (!Array.isArray(ring)) return null
  const pts = ring.filter(isXY)
  if (pts.length === 0) return null
  const sx = pts.reduce((s, p) => s + p[0], 0)
  const sy = pts.reduce((s, p) => s + p[1], 0)
  return [sx / pts.length, sy / pts.length]
}

export type UnitPolygon = { rings: XY[][]; unit: string; name: string }

/** Geology polygons as ring lists (MultiPolygon parts become separate entries). */
export function unitPolygons(fc: GeologyCollection): UnitPolygon[] {
  const out: UnitPolygon[] = []
  const toRing = (r: unknown): XY[] => (Array.isArray(r) ? r.filter(isXY).map((c) => [c[0], c[1]] as XY) : [])
  for (const f of fc.features) {
    const { unit, name } = f.properties
    const coords = f.geometry.coordinates as unknown[]
    const polys = f.geometry.type === 'Polygon' ? [coords] : coords
    for (const poly of polys) {
      if (!Array.isArray(poly)) continue
      const rings = poly.map(toRing).filter((r) => r.length >= 3)
      if (rings.length > 0) out.push({ rings, unit, name })
    }
  }
  return out
}

/** Loads a FeatureCollection; null when the request fails or the file is not a collection. */
export async function fetchCollection<T extends AnyCollection>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const json = (await res.json()) as { type?: string }
    return json && json.type === 'FeatureCollection' ? (json as T) : null
  } catch {
    return null
  }
}
