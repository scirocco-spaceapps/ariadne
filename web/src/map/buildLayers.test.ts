import { describe, expect, it } from 'vitest'
import type { Aoi, GeologyCollection, TrackCollection, WaypointCollection } from '../lib/types'
import type { AssetSource } from './assets'
import { buildLayers, LAYER_ORDER, layerEntries, orthoFile, type LayerId } from './buildLayers'
import { EMPTY_SITE, type SiteData } from './useSiteData'

const aoi = {
  id: 't',
  name: 'Test AOI',
  placeholder: true,
  crs: { proj4: '+proj=eqc' },
  origin_lonlat: [0, 0],
  size_m: [500, 400],
  assets_base: 'a/',
  rasters: {
    ortho: { file: 'ortho_50cm.jpg', px_m: 0.5 },
    ortho_small: { file: 'ortho_1m.jpg', px_m: 1 },
    hillshade: { file: 'hillshade_2m.png', px_m: 2 },
    dem: { file: 'dem_4m.f32', px_m: 4, dtype: 'float32', unit: 'm' },
    slope: { file: 'slope_2m.png', px_m: 2, legend: [{ max_deg: 10, color: '#1a9850', label: '0-10°' }] },
    traversability: {
      file: 'traversability_2m.png',
      px_m: 2,
      legend: [{ class: 'go', color: '#1a9850', label: 'Go' }],
    },
    cost_to_home: { file: 'cost_to_home_2m.f32', px_m: 2, dtype: 'float32', unit: 'min', nodata: 'NaN' },
  },
  vectors: { track: 'track.geojson', waypoints: 'waypoints.geojson', geology: { file: 'geology.geojson', optional: true } },
  safe_haven: { id: 'haven', name: 'Haven', xy: [60, 60] },
  stops: [{ id: 's1', name: 'Stop 1', xy: [220, 180] }],
  model: { budget_min: 240, reserve_min: 30, dwell_min: 20 },
} as Aoi

const source = (synthetic: boolean): AssetSource => ({
  aoi,
  url: (f) => `https://assets.test/a/${f}`,
  exists: async () => true,
  synthetic,
})

const meta = { type: 'FeatureCollection' as const, provenance: 'Observed' as const, source: 't' }
const track: TrackCollection = {
  ...meta,
  features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [10, 10]] }, properties: {} }],
}
const waypoints: WaypointCollection = {
  ...meta,
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [5, 5] }, properties: { sol: 1 } }],
}
const geology: GeologyCollection = {
  ...meta,
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[0, 0], [100, 0], [100, 100], [0, 0]]] },
      properties: { unit: 'Ba', name: 'Bright Angel' },
    },
  ],
}
const FULL: SiteData = { track, waypoints, geology }
const all = () => true

describe('buildLayers', () => {
  it('stacks every layer bottom to top, with labels above their shapes', () => {
    const ids = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false }).map((l) => l.id)
    expect(ids).toEqual([
      'ortho',
      'hillshade',
      'slope',
      'traversability',
      'geology',
      'geology-labels',
      'track',
      'waypoints',
      'places',
      'places-labels',
    ])
  })

  it('drops hidden layers', () => {
    const shown = new Set<LayerId>(['ortho', 'places'])
    const ids = buildLayers({ source: source(false), data: FULL, isVisible: (id) => shown.has(id), narrow: false }).map(
      (l) => l.id,
    )
    expect(ids).toEqual(['ortho', 'places', 'places-labels'])
  })

  it('uses the small ortho on narrow maps', () => {
    expect(orthoFile(aoi, false)).toBe('ortho_50cm.jpg')
    expect(orthoFile(aoi, true)).toBe('ortho_1m.jpg')
  })

  it('leaves out layers whose data is missing', () => {
    const ids = buildLayers({ source: source(false), data: EMPTY_SITE, isVisible: all, narrow: false }).map((l) => l.id)
    expect(ids).not.toContain('geology')
    expect(ids).not.toContain('track')
    expect(ids).not.toContain('waypoints')
    expect(ids).toContain('places')
  })
})

describe('layerEntries', () => {
  it('lists only layers with data, in stacking order', () => {
    const ids = layerEntries(source(false), { ...FULL, geology: null }).map((e) => e.id)
    expect(ids).toEqual(LAYER_ORDER.filter((id) => id !== 'geology'))
  })

  it('labels SYNTHETIC data as Simulation and placeholder places as Assumed', () => {
    const synth = layerEntries(source(true), FULL)
    expect(new Set(synth.map((e) => e.provenance))).toEqual(new Set(['Simulation']))
    const real = Object.fromEntries(layerEntries(source(false), FULL).map((e) => [e.id, e.provenance]))
    expect(real).toMatchObject({ ortho: 'Observed', slope: 'Derived', track: 'Observed', places: 'Assumed' })
  })

  it('carries the legends from aoi.json', () => {
    const slope = layerEntries(source(false), FULL).find((e) => e.id === 'slope')
    expect(slope?.legend).toEqual([{ color: '#1a9850', label: '0-10°' }])
  })
})
