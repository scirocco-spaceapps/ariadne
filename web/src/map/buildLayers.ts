// The map's layer stack. One table of definitions drives both the toggles (label, provenance,
// legend, order, default visibility) and the deck.gl layers, so they cannot drift apart.

import type { Layer } from '@deck.gl/core'
import { BitmapLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Provenance } from '../lib/types'
import type { AssetSource } from './assets'
import type { XY } from './coords'
import { linePaths, pointFeatures, polygonLabelPoint, unitPolygons, type UnitPolygon } from './geo'
import type { LayerEntry, LegendItem } from './layers'
import type { SiteData } from './useSiteData'

export type LayerId = 'ortho' | 'hillshade' | 'slope' | 'traversability' | 'geology' | 'track' | 'waypoints' | 'places'

/** Bottom to top. */
export const LAYER_ORDER: LayerId[] = [
  'ortho',
  'hillshade',
  'slope',
  'traversability',
  'geology',
  'track',
  'waypoints',
  'places',
]

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
export function layerEntries(source: AssetSource, data: SiteData): LayerEntry[] {
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
  entries.push({
    id: 'places',
    label: 'Stops and safe haven',
    provenance: synthetic ? 'Simulation' : aoi.placeholder ? 'Assumed' : 'Derived',
    visible: true,
  })
  return entries.map((e) => ({ ...e, order: order(e.id as LayerId) }))
}

/** The ortho file to draw: the 1 m version on narrow maps, the 50 cm one otherwise. */
export function orthoFile(aoi: AssetSource['aoi'], narrow: boolean): string {
  return narrow ? aoi.rasters.ortho_small.file : aoi.rasters.ortho.file
}

type Place = { xy: XY; name: string; haven: boolean }

export type BuildInput = {
  source: AssetSource
  data: SiteData
  isVisible: (id: LayerId) => boolean
  narrow: boolean
}

/** deck.gl layers, bottom to top, for the visible layers whose data is present. */
export function buildLayers({ source, data, isVisible, narrow }: BuildInput): Layer[] {
  const { aoi } = source
  const [w, h] = aoi.size_m
  const bounds: [number, number, number, number] = [0, 0, w, h]
  const out: Layer[] = []

  const bitmap = (id: LayerId, file: string, opacity = 1) =>
    new BitmapLayer({ id, image: source.url(file), bounds, opacity })

  for (const id of LAYER_ORDER) {
    if (!isVisible(id)) continue
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
              return xy ? [{ xy, name: p.name, haven: false }] : []
            }),
            11,
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
      case 'places': {
        const places: Place[] = [
          { xy: [aoi.safe_haven.xy[0], aoi.safe_haven.xy[1]], name: aoi.safe_haven.name, haven: true },
          ...aoi.stops.map((s) => ({ xy: [s.xy[0], s.xy[1]] as XY, name: s.name, haven: false })),
        ]
        out.push(
          new ScatterplotLayer<Place>({
            id: 'places',
            data: places,
            getPosition: (d) => d.xy,
            getRadius: (d) => (d.haven ? 8 : 6),
            radiusUnits: 'pixels',
            getFillColor: (d) => (d.haven ? [46, 204, 113, 255] : [251, 191, 36, 255]),
            stroked: true,
            getLineColor: [17, 22, 29, 255],
            lineWidthUnits: 'pixels',
            getLineWidth: 2,
          }),
          labelLayer('places-labels', places, 13),
        )
        break
      }
    }
  }
  return out
}

/** Readable text on imagery: light text on a dark box, constant screen size. */
function labelLayer(id: string, data: Place[], size: number) {
  return new TextLayer<Place>({
    id,
    data,
    getPosition: (d) => d.xy,
    getText: (d) => d.name,
    getSize: size,
    sizeUnits: 'pixels',
    getColor: [232, 237, 243, 255],
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'bottom',
    getPixelOffset: [0, -12],
    background: true,
    getBackgroundColor: [17, 22, 29, 215],
    backgroundPadding: [4, 2],
    characterSet: 'auto',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  })
}
