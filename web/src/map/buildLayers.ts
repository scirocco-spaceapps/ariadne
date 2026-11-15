// The map's layer stack. One table of definitions drives both the toggles (label, provenance,
// legend, order, default visibility) and the deck.gl layers, so they cannot drift apart.

import type { Layer } from '@deck.gl/core'
import { BitmapLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Provenance } from '../lib/types'
import type { AssetSource } from './assets'
import type { XY } from './coords'
import { linePaths, pointFeatures, polygonLabelPoint, unitPolygons, type UnitPolygon } from './geo'
import { ENVELOPE_COLORS, envelopeThresholds } from './envelope'
import { placeLabels, placementProps, type Placement } from './labels'
import type { LayerEntry, LegendItem } from './layers'
import { dashes, splitAt, type RouteGeometry } from './route'
import type { SiteData } from './useSiteData'

export type LayerId =
  | 'ortho'
  | 'hillshade'
  | 'slope'
  | 'traversability'
  | 'envelope'
  | 'seen'
  | 'geology'
  | 'track'
  | 'waypoints'
  | 'route'
  | 'thread'
  | 'suggestion'
  | 'targets'
  | 'places'
  | 'astronaut'

/** Bottom to top. */
export const LAYER_ORDER: LayerId[] = [
  'ortho',
  'hillshade',
  'slope',
  'traversability',
  'envelope',
  'seen',
  'geology',
  'track',
  'waypoints',
  'route',
  'thread',
  'suggestion',
  'targets',
  'places',
  'astronaut',
]

/** Layers drawn as part of another layer's toggle: the targets belong to "Seen, not touched". */
const TOGGLED_BY: Partial<Record<LayerId, LayerId>> = { targets: 'seen' }

// The B3 raster is orange (rgba(255, 140, 0, 200)), too close to the envelope's amber on a
// projector. The map greys it and tints it violet: luminance of #ff8c00 is about 0.6, times
// SEEN_TINT gives SEEN_HEX, the legend swatch.
const SEEN_TINT: [number, number, number] = [255, 110, 255]
const SEEN_HEX = '#9a439a'
const SEEN_RGB: Rgba = [255, 140, 0, 255]

/** Planned route colour (visual brief: --ink #e7efec); the red thread is kept for the way home (Y6). */
const ROUTE_RGB: Rgba = [231, 239, 236, 255]
const CASING_RGB: Rgba = [10, 17, 20, 200]
/** MPC-2 suggested way (visual brief: --sand #d9a877). */
const SUGGESTION_RGB: Rgba = [217, 168, 119, 255]
/** The way home during a storm alert (visual brief: --thread #ff5d6c). */
const THREAD_RGB: Rgba = [255, 93, 108, 255]
const HAVEN_RGB: Rgba = [46, 204, 113, 255]
/** Opacity of the planned route while an alert sends the astronaut home. */
const ROUTE_ALERT_OPACITY = 0.3

/** What the route and astronaut layers draw (Y4). */
export type MissionLayers = {
  geom: RouteGeometry | null
  /** Metres walked along the route. */
  progress_m: number
  /** Astronaut position, AOI metres; null hides the marker. */
  marker: XY | null
  /** Route stop numbers { stopId: 1..n }. */
  numbers: Record<string, number>
  selectedStop: string | null
  /** Dash length in metres for the part ahead (screen-sized: px x metres per pixel). */
  dash_m: number
  /** Storm alert (Y6): the way home and the haven pulse phase in [0, 1); null when there is none. */
  alert?: { path: XY[] | null; pulse: number } | null
  /** Selected B3 target id (Y7). */
  selectedTarget?: string | null
  /** MPC-2 replanning suggestion: the suggested way (dropped stops or home now), AOI metres. */
  suggestion?: XY[][] | null
}

/** Which mission layers exist, for the toggles. */
export type MissionEntries = {
  route: boolean
  astronaut: boolean
  routeProvenance: Provenance
  /** The cost-to-home raster loaded, so the return envelope can be drawn (Y5). */
  envelope?: boolean
  /** A storm alert is active (Y6): the thread is listed and the envelope legend switches. */
  alert?: boolean
  /** The envelope is drawn from the flat-ground variant (Y9 comparison). */
  flat?: boolean
  /** A replanning suggestion path is shown (MPC-2). */
  suggestion?: boolean
}

/** Below this map width the small ortho is used (fewer pixels, safer on phone GPUs). */
export const NARROW_PX = 768

type Rgba = [number, number, number, number]
const hex = (h: string, a = 255): Rgba => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
  a,
]
const UNIT_COLORS = ['#e6ab02', '#66a61e', '#e7298a', '#7570b3', '#d95f02', '#1b9e77', '#a6761d', '#666666']
function unitColor(unit: string): Rgba {
  let h = 0
  for (const ch of unit) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return hex(UNIT_COLORS[h % UNIT_COLORS.length], 90)
}

/** Provenance of a layer: SYNTHETIC fixtures are always Simulation. */
function prov(source: AssetSource, real: Provenance): Provenance {
  return source.synthetic ? 'Simulation' : real
}

/** Registry entries for every layer whose data is present. */
export function layerEntries(source: AssetSource, data: SiteData, mission?: MissionEntries): LayerEntry[] {
  const { aoi, synthetic } = source
  const legend = (items: { color: string; label: string }[] | undefined): LegendItem[] | undefined =>
    items?.map(({ color, label }) => ({ color, label }))
  const order = (id: LayerId) => LAYER_ORDER.indexOf(id)
  const entries: LayerEntry[] = [
    {
      id: 'ortho',
      label: synthetic ? 'Orthoimage (SYNTHETIC)' : 'Orthoimage, MRO HiRISE',
      provenance: prov(source, 'Observed'),
      visible: true,
    },
    { id: 'hillshade', label: 'Hillshade (from DEM)', provenance: prov(source, 'Derived'), visible: false },
    {
      id: 'slope',
      label: 'Slope',
      provenance: prov(source, 'Derived'),
      visible: false,
      legend: legend(aoi.rasters.slope.legend),
    },
    {
      id: 'traversability',
      label: 'Traversability',
      provenance: prov(source, 'Derived'),
      visible: false,
      legend: legend(aoi.rasters.traversability.legend),
    },
  ]
  if (mission?.envelope) {
    const { safe_min } = envelopeThresholds(aoi.model)
    const reserve = aoi.model.reserve_min
    const variant = mission.flat ? ' (flat ground, no terrain model)' : ''
    entries.push(
      mission.alert
        ? {
            id: 'envelope',
            label: `Return envelope: storm alert${variant}`,
            provenance: prov(source, 'Modeled'),
            visible: true,
            legend: [
              { color: ENVELOPE_COLORS.tight, label: 'Home before the storm' },
              { color: ENVELOPE_COLORS.out, label: 'Not home before the storm' },
            ],
          }
        : {
            id: 'envelope',
            label: `Return envelope${variant}`,
            provenance: prov(source, 'Modeled'),
            visible: true,
            legend: [
              { color: ENVELOPE_COLORS.safe, label: `Home with the ${reserve} min reserve and ${safe_min}+ min to spare` },
              { color: ENVELOPE_COLORS.tight, label: `Home with the reserve, under ${safe_min} min to spare` },
              { color: ENVELOPE_COLORS.out, label: 'Would eat into the reserve, or no way home' },
            ],
          },
    )
  }
  if (data.seen || data.targets) {
    entries.push({
      id: 'seen',
      label: 'Seen, not touched (rover viewsheds)',
      provenance: prov(source, 'Derived'),
      visible: true,
      legend: [
        ...(data.seen ? [{ color: SEEN_HEX, label: "Seen by the rover's cameras, never driven to" }] : []),
        ...(data.targets ? [{ color: '#11161d', label: 'Target the rover saw (click for its card)' }] : []),
      ],
    })
  }
  if (data.geology) {
    entries.push({ id: 'geology', label: 'Geologic units', provenance: prov(source, 'Observed'), visible: true })
  }
  if (data.track) {
    entries.push({
      id: 'track',
      label: synthetic ? 'Rover traverse (SYNTHETIC)' : 'Rover traverse, Perseverance',
      provenance: prov(source, 'Observed'),
      visible: true,
    })
  }
  if (data.waypoints) {
    entries.push({ id: 'waypoints', label: 'Rover waypoints', provenance: prov(source, 'Observed'), visible: true })
  }
  if (mission?.route) {
    entries.push({
      id: 'route',
      label: 'Planned route (dashed ahead, solid walked)',
      provenance: synthetic ? 'Simulation' : mission.routeProvenance,
      visible: true,
    })
  }
  if (mission?.suggestion) {
    entries.push({ id: 'suggestion', label: 'Replanning suggestion (what if)', provenance: 'Simulation', visible: true })
  }
  if (mission?.alert) {
    entries.push({ id: 'thread', label: 'Way home before the storm', provenance: 'Simulation', visible: true })
  }
  entries.push({
    id: 'places',
    label: 'Stops and safe haven',
    provenance: synthetic ? 'Simulation' : aoi.placeholder ? 'Assumed' : 'Derived',
    visible: true,
  })
  if (mission?.astronaut) {
    entries.push({ id: 'astronaut', label: 'Astronaut position', provenance: 'Simulation', visible: true })
  }
  return entries.map((e) => ({ ...e, order: order(e.id as LayerId) }))
}

/** The ortho file to draw: the 1 m version on narrow maps, the 50 cm one otherwise. */
export function orthoFile(aoi: AssetSource['aoi'], narrow: boolean): string {
  return narrow ? aoi.rasters.ortho_small.file : aoi.rasters.ortho.file
}

type Label = { xy: XY; name: string }
type Target = Label & { id: string; selected: boolean }

/** "target-cheyava-falls" -> "Target · Cheyava Falls · sol 1182". */
export function targetLabel(id: string, sol: number | null): string {
  const words = id
    .replace(/^target-/, '')
    .split('-')
    .filter((w) => w !== '')
    .map((w) => w[0].toUpperCase() + w.slice(1))
  return ['Target', words.join(' ') || id, sol !== null ? `sol ${sol}` : null].filter(Boolean).join(' · ')
}
type Place = Label & { id: string; haven: boolean; n: number | null; selected: boolean }

export type BuildInput = {
  source: AssetSource
  data: SiteData
  isVisible: (id: LayerId) => boolean
  narrow: boolean
  mission?: MissionLayers
  /** The return envelope at the current time, drawn on an offscreen canvas (Y5). */
  envelope?: { image: HTMLCanvasElement } | null
  /** Screen pixels per metre; when given, place-name labels are moved so they do not overlap (Y9). */
  ppm?: number
  /** Only build these layers (the map builds the moving astronaut apart from the rest); default all. */
  include?: (id: LayerId) => boolean
}

/** deck.gl layers, bottom to top, for the visible layers whose data is present. */
export function buildLayers({ source, data, isVisible, narrow, mission, envelope, ppm, include }: BuildInput): Layer[] {
  const { aoi } = source
  const [w, h] = aoi.size_m
  const bounds: [number, number, number, number] = [0, 0, w, h]
  const out: Layer[] = []

  const bitmap = (id: LayerId, file: string, opacity = 1) =>
    new BitmapLayer({ id, image: source.url(file), bounds, opacity })

  for (const id of LAYER_ORDER) {
    if (include && !include(id)) continue
    if (!isVisible(TOGGLED_BY[id] ?? id)) continue
    switch (id) {
      case 'ortho':
        out.push(bitmap('ortho', orthoFile(aoi, narrow)))
        break
      case 'hillshade':
        out.push(bitmap('hillshade', aoi.rasters.hillshade.file, 0.5))
        break
      case 'slope':
        out.push(bitmap('slope', aoi.rasters.slope.file, 0.6))
        break
      case 'traversability':
        out.push(bitmap('traversability', aoi.rasters.traversability.file, 0.6))
        break
      case 'envelope':
        if (!envelope) break
        out.push(new BitmapLayer({ id: 'envelope', image: envelope.image, bounds }))
        break
      case 'seen': {
        const ref = aoi.rasters.seen_not_touched
        if (data.seen && ref) {
          out.push(
            new BitmapLayer({
              id: 'seen',
              image: source.url(ref.file),
              bounds,
              opacity: 0.8,
              desaturate: 1,
              tintColor: SEEN_TINT,
            }),
          )
        }
        break
      }
      case 'targets': {
        if (!data.targets) break
        const selected = mission?.selectedTarget ?? null
        const targets: Target[] = pointFeatures(data.targets).flatMap((p) => {
          const id = p.properties.id
          if (typeof id !== 'string') return []
          const sol = typeof p.properties.sol === 'number' ? p.properties.sol : null
          return [{ id, xy: p.xy, name: targetLabel(id, sol), selected: id === selected }]
        })
        out.push(
          new ScatterplotLayer<Target>({
            id: 'targets',
            data: targets,
            pickable: true,
            getPosition: (d) => d.xy,
            getRadius: 7,
            radiusUnits: 'pixels',
            getFillColor: [17, 22, 29, 235],
            stroked: true,
            getLineColor: (d) => (d.selected ? SEEN_RGB : [255, 255, 255, 255]),
            lineWidthUnits: 'pixels',
            getLineWidth: (d) => (d.selected ? 4 : 2.5),
            updateTriggers: { getLineColor: selected, getLineWidth: selected },
          }),
        )
        const picked = targets.filter((t) => t.selected)
        if (picked.length > 0) out.push(labelLayer('targets-label', picked, 13, 14, ppm))
        break
      }
      case 'geology': {
        if (!data.geology) break
        const polys = unitPolygons(data.geology)
        out.push(
          new PolygonLayer<UnitPolygon>({
            id: 'geology',
            data: polys,
            getPolygon: (d) => d.rings,
            getFillColor: (d) => unitColor(d.unit),
            getLineColor: [255, 255, 255, 170],
            lineWidthUnits: 'pixels',
            getLineWidth: 1,
          }),
          labelLayer(
            'geology-labels',
            polys.flatMap((p) => {
              const xy = polygonLabelPoint(p.rings)
              return xy ? [{ xy, name: p.name }] : []
            }),
            12,
            12,
            ppm,
          ),
        )
        break
      }
      case 'track':
        if (!data.track) break
        out.push(
          new PathLayer<XY[]>({
            id: 'track',
            data: linePaths(data.track),
            getPath: (p) => p,
            positionFormat: 'XY',
            getColor: [80, 220, 255, 255],
            getWidth: 2.5,
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
          }),
        )
        break
      case 'waypoints':
        if (!data.waypoints) break
        out.push(
          new ScatterplotLayer<{ xy: XY }>({
            id: 'waypoints',
            data: pointFeatures(data.waypoints),
            getPosition: (d) => d.xy,
            getRadius: 3.5,
            radiusUnits: 'pixels',
            getFillColor: [255, 255, 255, 255],
            stroked: true,
            getLineColor: [20, 30, 40, 255],
            lineWidthUnits: 'pixels',
            getLineWidth: 1,
          }),
        )
        break
      case 'route': {
        if (!mission?.geom || mission.geom.legs.length === 0) break
        const { walked, ahead } = splitAt(mission.geom, mission.progress_m)
        const dashed = ahead.flatMap((p) => dashes(p, mission.dash_m, mission.dash_m * 0.75))
        const opacity = mission.alert ? ROUTE_ALERT_OPACITY : 1
        const path = (pid: string, paths: XY[][], color: Rgba, width: number) =>
          new PathLayer<XY[]>({
            id: pid,
            data: paths,
            getPath: (p) => p,
            positionFormat: 'XY',
            getColor: color,
            getWidth: width,
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
            opacity,
          })
        out.push(
          // A soft halo under the walked part: the thread the astronaut has already laid.
          path('route-walked-glow', walked, [231, 239, 236, 55], 16),
          path('route-ahead-casing', dashed, CASING_RGB, 5),
          path('route-ahead', dashed, ROUTE_RGB, 2.5),
          path('route-walked-casing', walked, CASING_RGB, 6.5),
          path('route-walked', walked, ROUTE_RGB, 4),
        )
        break
      }
      case 'suggestion': {
        const ways = mission?.suggestion?.filter((p) => p.length >= 2)
        if (!ways || ways.length === 0) break
        const dashed = ways.flatMap((p) => dashes(p, mission!.dash_m, mission!.dash_m * 0.6))
        const sug = (sid: string, color: Rgba, width: number) =>
          new PathLayer<XY[]>({
            id: sid,
            data: dashed,
            getPath: (p) => p,
            positionFormat: 'XY',
            getColor: color,
            getWidth: width,
            widthUnits: 'pixels',
            capRounded: true,
          })
        out.push(sug('suggestion-casing', CASING_RGB, 6), sug('suggestion', SUGGESTION_RGB, 3.5))
        break
      }
      case 'thread': {
        const way = mission?.alert?.path
        if (!way || way.length < 2) break
        const thread = (tid: string, color: Rgba, width: number) =>
          new PathLayer<XY[]>({
            id: tid,
            data: [way],
            getPath: (p) => p,
            positionFormat: 'XY',
            getColor: color,
            getWidth: width,
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
          })
        out.push(
          thread('thread-glow-wide', [255, 93, 108, 40], 26),
          thread('thread-glow', [255, 93, 108, 90], 14),
          thread('thread-casing', CASING_RGB, 8),
          thread('thread', THREAD_RGB, 5),
        )
        break
      }
      case 'places': {
        const numbers = mission?.numbers ?? {}
        if (mission?.alert) {
          // Pulse ring around the safe haven while an alert sends the astronaut home.
          const phase = mission.alert.pulse
          out.push(
            new ScatterplotLayer<{ xy: XY }>({
              id: 'haven-pulse',
              data: [{ xy: [aoi.safe_haven.xy[0], aoi.safe_haven.xy[1]] }],
              getPosition: (d) => d.xy,
              getRadius: 10 + 22 * phase,
              radiusUnits: 'pixels',
              filled: false,
              stroked: true,
              getLineColor: [HAVEN_RGB[0], HAVEN_RGB[1], HAVEN_RGB[2], Math.round(230 * (1 - phase))],
              lineWidthUnits: 'pixels',
              getLineWidth: 3,
              updateTriggers: { getRadius: phase, getLineColor: phase },
            }),
          )
        }
        const selected = mission?.selectedStop ?? null
        const places: Place[] = [
          {
            id: aoi.safe_haven.id,
            xy: [aoi.safe_haven.xy[0], aoi.safe_haven.xy[1]],
            name: aoi.safe_haven.name,
            haven: true,
            n: null,
            selected: false,
          },
          ...aoi.stops.map((s) => ({
            id: s.id,
            xy: [s.xy[0], s.xy[1]] as XY,
            name: s.name,
            haven: false,
            n: numbers[s.id] ?? null,
            selected: s.id === selected,
          })),
        ]
        const numbered = places.filter((p) => p.n !== null)
        out.push(
          new ScatterplotLayer<Place>({
            id: 'places',
            data: places,
            pickable: true,
            getPosition: (d) => d.xy,
            getRadius: (d) => (d.haven ? 8 : d.n !== null ? 10 : 6),
            radiusUnits: 'pixels',
            getFillColor: (d) => (d.haven ? HAVEN_RGB : [251, 191, 36, 255]),
            stroked: true,
            getLineColor: (d) => (d.selected ? [255, 255, 255, 255] : [17, 22, 29, 255]),
            lineWidthUnits: 'pixels',
            getLineWidth: (d) => (d.selected ? 4 : 2),
            updateTriggers: { getLineColor: selected, getLineWidth: selected, getRadius: numbers },
          }),
        )
        if (numbered.length > 0) {
          out.push(
            new TextLayer<Place>({
              id: 'places-numbers',
              data: numbered,
              getPosition: (d) => d.xy,
              getText: (d) => String(d.n),
              getSize: 13,
              sizeUnits: 'pixels',
              getColor: [17, 22, 29, 255],
              getTextAnchor: 'middle',
              getAlignmentBaseline: 'center',
              fontWeight: 700,
              fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            }),
          )
        }
        out.push(labelLayer('places-labels', places, 15, 16, ppm))
        break
      }
      case 'astronaut': {
        if (!mission?.marker) break
        const me = [{ xy: mission.marker, name: 'Astronaut · Simulation' }]
        out.push(
          new ScatterplotLayer<Label>({
            id: 'astronaut-halo',
            data: me,
            getPosition: (d) => d.xy,
            getRadius: 20,
            radiusUnits: 'pixels',
            getFillColor: [217, 168, 119, 55],
            stroked: true,
            getLineColor: [217, 168, 119, 140],
            lineWidthUnits: 'pixels',
            getLineWidth: 1.5,
          }),
          new ScatterplotLayer<Label>({
            id: 'astronaut',
            data: me,
            getPosition: (d) => d.xy,
            getRadius: 7,
            radiusUnits: 'pixels',
            getFillColor: [255, 255, 255, 255],
            stroked: true,
            getLineColor: [217, 168, 119, 255], // --sand
            lineWidthUnits: 'pixels',
            getLineWidth: 3,
          }),
          // Below the marker: at the start the astronaut stands on the safe haven, whose name is above.
          new TextLayer<Label>({
            ...labelProps(13, 14),
            id: 'astronaut-label',
            data: me,
            getAlignmentBaseline: 'top',
            getPixelOffset: [0, 14],
          }),
        )
        break
      }
    }
  }
  return out
}

/**
 * Readable text on imagery: light text on a dark box, constant screen size. With ppm (pixels per
 * metre) the labels are placed so they do not overlap at the current zoom.
 */
function labelLayer(id: string, data: Label[], size: number, offset = 12, ppm?: number) {
  if (!ppm) return new TextLayer<Label>({ ...labelProps(size, offset), id, data })
  return new TextLayer<PlacedLabel>({
    ...labelProps(size, offset),
    id,
    data: placeLabels(data, ppm, size, offset),
    getTextAnchor: (d) => placementProps(d.placement, offset).anchor,
    getAlignmentBaseline: (d) => placementProps(d.placement, offset).baseline,
    getPixelOffset: (d) => [...placementProps(d.placement, offset).pixelOffset] as [number, number],
  })
}

type PlacedLabel = Label & { placement: Placement }

function labelProps(size: number, offset: number) {
  return {
    getPosition: (d: Label) => d.xy,
    getText: (d: Label) => d.name,
    getSize: size,
    sizeUnits: 'pixels' as const,
    getColor: [232, 237, 243, 255] as Rgba,
    getTextAnchor: 'middle' as const,
    getAlignmentBaseline: 'bottom' as const,
    getPixelOffset: [0, -offset] as [number, number],
    background: true,
    getBackgroundColor: [17, 22, 29, 235] as Rgba,
    backgroundPadding: [4, 2] as [number, number],
    characterSet: 'auto' as const,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontWeight: 600,
  }
}
