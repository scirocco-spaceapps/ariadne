import { describe, expect, it } from 'vitest'
import type { Aoi, GeologyCollection, TrackCollection, WaypointCollection } from '../lib/types'
import type { AssetSource } from './assets'
import { fixtures } from '../lib/fixtures'
import { buildLayers, LAYER_ORDER, layerEntries, orthoFile, type LayerId, type MissionLayers } from './buildLayers'
import { routeGeometry, stopNumbers } from './route'
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
    expect(ids).toEqual(LAYER_ORDER.filter((id) => !['geology', 'route', 'astronaut'].includes(id)))
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

describe('route, numbered stops and astronaut (Y4)', () => {
  const route = fixtures.route
  const geom = routeGeometry(route)
  const mission: MissionLayers = {
    geom,
    progress_m: geom.legs[0].length + 50,
    marker: [260, 210],
    numbers: stopNumbers(route),
    selectedStop: 's1',
    dash_m: 10,
  }
  const layers = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false, mission })
  const byId = Object.fromEntries(layers.map((l) => [l.id, l]))

  it('draws the route under the stops and the astronaut on top', () => {
    const ids = layers.map((l) => l.id)
    expect(ids.slice(ids.indexOf('waypoints') + 1)).toEqual([
      'route-ahead-casing',
      'route-ahead',
      'route-walked-casing',
      'route-walked',
      'places',
      'places-numbers',
      'places-labels',
      'astronaut',
      'astronaut-label',
    ])
  })

  it('splits walked (solid) from ahead (dashed)', () => {
    const walked = byId['route-walked'].props.data as unknown[]
    const ahead = byId['route-ahead'].props.data as unknown[]
    expect(walked).toHaveLength(2) // leg 0 and the walked part of leg 1
    expect(ahead.length).toBeGreaterThan(5) // the rest of leg 1 cut into 10 m dashes
  })

  it('makes stops clickable, numbers route stops and rings the selected one', () => {
    expect(byId['places'].props.pickable).toBe(true)
    const numbered = byId['places-numbers'].props.data as { id: string; n: number }[]
    expect(numbered.map((p) => p.n)).toEqual([1]) // only s1 is in this AOI
    const places = byId['places'].props.data as { id: string; selected: boolean }[]
    expect(places.find((p) => p.id === 's1')?.selected).toBe(true)
  })

  it('registers the route and the astronaut with their provenance', () => {
    const entries = layerEntries(source(false), FULL, { route: true, astronaut: true, routeProvenance: 'Modeled' })
    const prov = Object.fromEntries(entries.map((e) => [e.id, e.provenance]))
    expect(prov).toMatchObject({ route: 'Modeled', astronaut: 'Simulation' })
    const synth = layerEntries(source(true), FULL, { route: true, astronaut: true, routeProvenance: 'Modeled' })
    expect(synth.find((e) => e.id === 'route')?.provenance).toBe('Simulation')
  })

  it('draws no route or astronaut without a mission', () => {
    const ids = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false }).map((l) => l.id)
    expect(ids.some((id) => id.startsWith('route') || id.startsWith('astronaut'))).toBe(false)
  })
})
