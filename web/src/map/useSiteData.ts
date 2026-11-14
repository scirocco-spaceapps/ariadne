// Loads the vector files of the AOI. A file that is absent or fails to load stays null, and the
// map leaves its layer (and toggle) out instead of breaking.

import { useEffect, useState } from 'react'
import type { GeologyCollection, TrackCollection, VectorRef, WaypointCollection } from '../lib/types'
import type { AssetSource } from './assets'
import { fetchCollection } from './geo'

export type SiteData = {
  track: TrackCollection | null
  waypoints: WaypointCollection | null
  geology: GeologyCollection | null
}

export const EMPTY_SITE: SiteData = { track: null, waypoints: null, geology: null }

/** File name and optional flag of a vector entry, or null when aoi.json does not list it. */
export function vectorFile(ref: VectorRef | undefined): { file: string; optional: boolean } | null {
  if (!ref) return null
  return typeof ref === 'string' ? { file: ref, optional: false } : { file: ref.file, optional: ref.optional ?? false }
}

async function load<T extends TrackCollection | WaypointCollection | GeologyCollection>(
  source: AssetSource,
  ref: VectorRef | undefined,
): Promise<T | null> {
  const v = vectorFile(ref)
  if (!v) return null
  if (v.optional && !(await source.exists(v.file))) return null
  return fetchCollection<T>(source.url(v.file))
}

export function useSiteData(source: AssetSource): SiteData {
  const [data, setData] = useState<SiteData>(EMPTY_SITE)
  useEffect(() => {
    let cancelled = false
    const { vectors } = source.aoi
    Promise.all([
      load<TrackCollection>(source, vectors.track),
      load<WaypointCollection>(source, vectors.waypoints),
      load<GeologyCollection>(source, vectors.geology),
    ]).then(([track, waypoints, geology]) => {
      if (!cancelled) setData({ track, waypoints, geology })
    })
    return () => {
      cancelled = true
    }
  }, [source])
  return data
}
