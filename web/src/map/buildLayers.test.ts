import { describe, expect, it } from 'vitest'
import type { Aoi, GeologyCollection, TargetCollection, TrackCollection, WaypointCollection } from '../lib/types'
import type { AssetSource } from './assets'
import { fixtures } from '../lib/fixtures'
import {
  buildLayers,
  LAYER_ORDER,
  layerEntries,
  orthoFile,
  targetLabel,
  type LayerId,
  type MissionLayers,
} from './buildLayers'
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
const FULL: SiteData = { track, waypoints, geology, targets: null, seen: false }
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
    const absent = ['geology', 'route', 'astronaut', 'envelope', 'thread', 'seen', 'targets', 'suggestion']
    expect(ids).toEqual(LAYER_ORDER.filter((id) => !absent.includes(id)))
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
      'route-walked-glow',
      'route-ahead-casing',
      'route-ahead',
      'route-walked-casing',
      'route-walked',
      'places',
      'places-numbers',
      'places-labels',
      'astronaut-halo',
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

describe('return envelope (Y5)', () => {
  const image = {} as HTMLCanvasElement

  it('stacks the envelope over the rasters and under the vectors', () => {
    const ids = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false, envelope: { image } }).map(
      (l) => l.id,
    )
    expect(ids.indexOf('envelope')).toBe(ids.indexOf('traversability') + 1)
    expect(ids.indexOf('envelope')).toBeLessThan(ids.indexOf('geology'))
  })

  it('draws nothing until the raster is loaded', () => {
    const ids = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false, envelope: null }).map(
      (l) => l.id,
    )
    expect(ids).not.toContain('envelope')
  })

  it('builds the legend from the reserve in aoi.model', () => {
    const entries = layerEntries(source(false), FULL, {
      route: false,
      astronaut: false,
      routeProvenance: 'Modeled',
      envelope: true,
    })
    const env = entries.find((e) => e.id === 'envelope')
    expect(env?.provenance).toBe('Modeled')
    expect(env?.label).toBe('Return envelope')
    expect(env?.legend?.map((l) => l.label)).toEqual([
      'Home with the 30 min reserve and 30+ min to spare',
      'Home with the reserve, under 30 min to spare',
      'Would eat into the reserve, or no way home',
    ])
    const synth = layerEntries(source(true), FULL, { route: false, astronaut: false, routeProvenance: 'Modeled', envelope: true })
    expect(synth.find((e) => e.id === 'envelope')?.provenance).toBe('Simulation')
  })

  it('names the flat-ground variant while the comparison is on (Y9)', () => {
    const entries = layerEntries(source(false), FULL, {
      route: false,
      astronaut: false,
      routeProvenance: 'Modeled',
      envelope: true,
      flat: true,
    })
    expect(entries.find((e) => e.id === 'envelope')?.label).toBe('Return envelope (flat ground, no terrain model)')
  })
})

describe('storm alert (Y6)', () => {
  const route = fixtures.route
  const geom = routeGeometry(route)
  const base: MissionLayers = {
    geom,
    progress_m: 100,
    marker: [300, 240],
    numbers: stopNumbers(route),
    selectedStop: null,
    dash_m: 10,
  }
  const build = (alert: MissionLayers['alert']) =>
    buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false, mission: { ...base, alert } })
  const alerted = build({ path: [[380, 300], [220, 180], [60, 60]], pulse: 0.5 })
  const cleared = build(null)
  const ids = (ls: typeof alerted) => ls.map((l) => l.id)
  const byId = (ls: typeof alerted) => Object.fromEntries(ls.map((l) => [l.id, l]))

  it('draws the thread above the route and pulses the haven only during an alert', () => {
    const a = ids(alerted)
    expect(a.indexOf('thread')).toBeGreaterThan(a.indexOf('route-walked'))
    expect(a.indexOf('thread')).toBeLessThan(a.indexOf('places'))
    expect(a).toContain('haven-pulse')
    expect(ids(cleared)).not.toContain('thread')
    expect(ids(cleared)).not.toContain('haven-pulse')
  })

  it('fades the planned route during the alert and restores it after', () => {
    expect(byId(alerted)['route-walked'].props.opacity).toBeLessThan(1)
    expect(byId(cleared)['route-walked'].props.opacity).toBe(1)
  })

  it('switches the toggle entries and drops the thread on clear', () => {
    const entries = (alert: boolean) =>
      layerEntries(source(false), FULL, { route: true, astronaut: true, routeProvenance: 'Modeled', envelope: true, alert })
    const on = entries(true)
    expect(on.find((e) => e.id === 'thread')?.provenance).toBe('Simulation')
    expect(on.find((e) => e.id === 'envelope')?.legend?.map((l) => l.label)).toEqual([
      'Home before the storm',
      'Not home before the storm',
    ])
    const off = entries(false)
    expect(off.find((e) => e.id === 'thread')).toBeUndefined()
    expect(off.find((e) => e.id === 'envelope')?.legend).toHaveLength(3)
  })
})

describe('seen, not touched (Y7)', () => {
  const targets: TargetCollection = {
    type: 'FeatureCollection',
    provenance: 'Derived',
    source: 't',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [100, 100] },
        properties: { id: 'target-cheyava-falls', area_m2: 2444, distance_m: 63.8, sol: 1182 },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [200, 150] },
        properties: { id: 'target-closest-pass', area_m2: 1672, distance_m: 24.4, sol: 1158 },
      },
    ],
  }
  const withSeen = (src: AssetSource): AssetSource => ({
    ...src,
    aoi: { ...src.aoi, rasters: { ...src.aoi.rasters, seen_not_touched: { file: 'seen_not_touched_2m.png', px_m: 2 } } },
  })
  const SEEN: SiteData = { ...FULL, targets, seen: true }
  const mission = (selectedTarget: string | null): MissionLayers => ({
    geom: null,
    progress_m: 0,
    marker: null,
    numbers: {},
    selectedStop: null,
    dash_m: 10,
    selectedTarget,
  })
  const build = (src: AssetSource, data: SiteData, extra: Partial<Parameters<typeof buildLayers>[0]> = {}) =>
    buildLayers({ source: src, data, isVisible: all, narrow: false, ...extra })

  it('draws the raster above the rasters and the targets just under the stops', () => {
    const ids = build(withSeen(source(false)), SEEN).map((l) => l.id)
    expect(ids.indexOf('seen')).toBe(ids.indexOf('traversability') + 1)
    expect(ids.indexOf('seen')).toBeLessThan(ids.indexOf('geology'))
    expect(ids.indexOf('targets')).toBe(ids.indexOf('places') - 1)
  })

  it('makes targets clickable and labels only the selected one', () => {
    const ls = build(withSeen(source(false)), SEEN, { mission: mission('target-closest-pass') })
    const byId = Object.fromEntries(ls.map((l) => [l.id, l]))
    expect(byId['targets'].props.pickable).toBe(true)
    const data = byId['targets'].props.data as { id: string; selected: boolean }[]
    expect(data.map((d) => [d.id, d.selected])).toEqual([
      ['target-cheyava-falls', false],
      ['target-closest-pass', true],
    ])
    expect((byId['targets-label'].props.data as { name: string }[])[0].name).toBe('Target · Closest Pass · sol 1158')
  })

  it('toggles raster and targets together under one entry', () => {
    const shown = new Set<LayerId>(['ortho', 'places'])
    const ids = build(withSeen(source(false)), SEEN, { isVisible: (id: LayerId) => shown.has(id) }).map((l) => l.id)
    expect(ids).not.toContain('seen')
    expect(ids).not.toContain('targets')
    const entries = layerEntries(withSeen(source(false)), SEEN)
    expect(entries.filter((e) => e.id === 'seen' || e.id === 'targets').map((e) => e.id)).toEqual(['seen'])
    expect(entries.find((e) => e.id === 'seen')?.provenance).toBe('Derived')
    expect(layerEntries(withSeen(source(true)), SEEN).find((e) => e.id === 'seen')?.provenance).toBe('Simulation')
  })

  it('hides the toggle and draws nothing when both assets are missing', () => {
    expect(layerEntries(source(false), FULL).find((e) => e.id === 'seen')).toBeUndefined()
    const ids = build(source(false), FULL).map((l) => l.id)
    expect(ids).not.toContain('seen')
    expect(ids).not.toContain('targets')
  })

  it('still shows the targets when only the raster is missing', () => {
    const data: SiteData = { ...FULL, targets, seen: false }
    const ids = build(withSeen(source(false)), data).map((l) => l.id)
    expect(ids).toContain('targets')
    expect(ids).not.toContain('seen')
    expect(layerEntries(withSeen(source(false)), data).find((e) => e.id === 'seen')?.legend).toHaveLength(1)
  })

  it('names targets from their id', () => {
    expect(targetLabel('target-cheyava-falls', 1182)).toBe('Target · Cheyava Falls · sol 1182')
    expect(targetLabel('t1', null)).toBe('Target · T1')
  })
})

describe('replanning suggestion (MPC-2)', () => {
  const base: MissionLayers = { geom: null, progress_m: 0, marker: null, numbers: {}, selectedStop: null, dash_m: 10 }
  const way: [number, number][] = [
    [0, 0],
    [100, 0],
  ]

  it('draws the suggested way dashed above the thread and lists it only while shown', () => {
    const ids = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false, mission: { ...base, suggestion: [way] } }).map((l) => l.id)
    expect(ids).toContain('suggestion')
    expect(ids.indexOf('suggestion')).toBeLessThan(ids.indexOf('places'))
    const entries = layerEntries(source(false), FULL, { route: true, astronaut: true, routeProvenance: 'Modeled', suggestion: true })
    expect(entries.find((e) => e.id === 'suggestion')?.provenance).toBe('Simulation')
    expect(layerEntries(source(false), FULL).find((e) => e.id === 'suggestion')).toBeUndefined()
    const none = buildLayers({ source: source(false), data: FULL, isVisible: all, narrow: false, mission: base }).map((l) => l.id)
    expect(none).not.toContain('suggestion')
  })
})
