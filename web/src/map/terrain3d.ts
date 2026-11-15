// 3D terrain view: the HiRISE DEM as a lit mesh with the orthoimage draped on it, the return envelope
// as a second skin just above, and the route, the thread home, the stops and the astronaut lifted
// onto the surface. Same AOI metres as the 2D map (x east, y north), z up, vertical exaggeration EXAG.

import { AmbientLight, DirectionalLight, LightingEffect, type Layer } from '@deck.gl/core'
import { LineLayer, PathLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import { SimpleMeshLayer } from '@deck.gl/mesh-layers'
import { useEffect, useState } from 'react'
import type { AssetSource } from './assets'
import type { XY } from './coords'
import { linePaths } from './geo'
import { splitAt } from './route'
import type { LayerId, MissionLayers } from './buildLayers'
import type { SiteData } from './useSiteData'

/**
 * Vertical exaggeration, at most 3x: Bright Angel's ~60 m of relief over 2.5 km looks flat at 1x.
 * Capped so the relief never exceeds ~7 % of the site width (the small fixture AOI stays at 1x).
 */
function exaggeration(reliefM: number, widthM: number): number {
  if (reliefM <= 0) return 1
  return Math.min(3, Math.max(1, (0.07 * widthM) / reliefM))
}
/** Metres (before exaggeration) that lines and markers float above the ground, so they never clip. */
const LIFT = 3

type Rgba = [number, number, number, number]

/**
 * A low, warm sun from the west and a cool sky fill: the grey HiRISE image reads as Martian ground
 * and every ridge throws a soft shadow side. Lighting only; no colour is invented in the data.
 */
export const MARS_LIGHT = new LightingEffect({
  sky: new AmbientLight({ color: [120, 140, 165], intensity: 0.55 }),
  sun: new DirectionalLight({ color: [255, 186, 132], intensity: 1.9, direction: [1, 0.35, -0.55] }),
})
/** Labels and markers are drawn over the terrain and the light pillars, never hidden by them. */
const ON_TOP = { depthCompare: 'always' as const }
const THREAD: Rgba = [255, 93, 108, 255]
const ROUTE: Rgba = [238, 243, 241, 255]
const SAND: Rgba = [217, 168, 119, 255]
const HAVEN: Rgba = [70, 197, 139, 255]
const STOP: Rgba = [251, 191, 36, 255]

export type Terrain = {
  /** Mesh in AOI metres, z already exaggerated and relative to the DEM minimum. */
  mesh: { attributes: { positions: { value: Float32Array; size: 3 }; normals: { value: Float32Array; size: 3 }; texCoords: { value: Float32Array; size: 2 } }; indices: { value: Uint32Array; size: 1 } }
  /** Height of the surface (exaggerated, relative) at an AOI point; NaN outside or on no-data. */
  zAt: (x: number, y: number) => number
  zMax: number
  /** Vertical exaggeration used for z. */
  exag: number
}

/** Builds the terrain mesh from a north-up float32 DEM, sampling every `step` cells. */
export function buildTerrain(dem: Float32Array, cols: number, rows: number, px_m: number, size_m: [number, number], step: number): Terrain {
  let zmin = Infinity
  let zmax = -Infinity
  for (const v of dem) {
    if (Number.isFinite(v)) {
      if (v < zmin) zmin = v
      if (v > zmax) zmax = v
    }
  }
  if (!Number.isFinite(zmin)) zmin = zmax = 0
  const EXAG = exaggeration(zmax - zmin, size_m[0])
  const h = (c: number, r: number) => {
    const v = dem[Math.min(rows - 1, Math.max(0, r)) * cols + Math.min(cols - 1, Math.max(0, c))]
    return Number.isFinite(v) ? (v - zmin) * EXAG : 0
  }
  const nc = Math.floor((cols - 1) / step) + 1
  const nr = Math.floor((rows - 1) / step) + 1
  const positions = new Float32Array(nc * nr * 3)
  const normals = new Float32Array(nc * nr * 3)
  const texCoords = new Float32Array(nc * nr * 2)
  for (let j = 0; j < nr; j++) {
    for (let i = 0; i < nc; i++) {
      const c = i * step
      const r = j * step
      const k = j * nc + i
      positions[k * 3] = (c + 0.5) * px_m
      positions[k * 3 + 1] = size_m[1] - (r + 0.5) * px_m
      positions[k * 3 + 2] = h(c, r)
      // Normal from central differences (y grows north, rows grow south).
      const dzdx = (h(c + step, r) - h(c - step, r)) / (2 * step * px_m)
      const dzdy = (h(c, r - step) - h(c, r + step)) / (2 * step * px_m)
      const len = Math.hypot(dzdx, dzdy, 1)
      normals[k * 3] = -dzdx / len
      normals[k * 3 + 1] = -dzdy / len
      normals[k * 3 + 2] = 1 / len
      texCoords[k * 2] = (c + 0.5) / cols
      texCoords[k * 2 + 1] = (r + 0.5) / rows
    }
  }
  const indices = new Uint32Array((nc - 1) * (nr - 1) * 6)
  let n = 0
  for (let j = 0; j < nr - 1; j++) {
    for (let i = 0; i < nc - 1; i++) {
      const a = j * nc + i
      const b = a + 1
      const c = a + nc
      const d = c + 1
      indices.set([a, c, b, b, c, d], n)
      n += 6
    }
  }
  const zAt = (x: number, y: number) => {
    const c = Math.floor(x / px_m)
    const r = Math.floor((size_m[1] - y) / px_m)
    if (c < 0 || r < 0 || c >= cols || r >= rows) return NaN
    const v = dem[r * cols + c]
    return Number.isFinite(v) ? (v - zmin) * EXAG : NaN
  }
  return {
    mesh: {
      attributes: {
        positions: { value: positions, size: 3 },
        normals: { value: normals, size: 3 },
        texCoords: { value: texCoords, size: 2 },
      },
      indices: { value: indices, size: 1 },
    },
    zAt,
    zMax: (zmax - zmin) * EXAG,
    exag: EXAG,
  }
}

/** Loads the AOI's DEM and builds the terrain once per source; null while loading or on failure. */
export function useTerrain(source: AssetSource): Terrain | null {
  return useTerrainState(source).terrain
}

/** The terrain plus whether it is still loading (false once it is ready or has failed). */
export function useTerrainState(source: AssetSource): { terrain: Terrain | null; loading: boolean } {
  const [failed, setFailed] = useState<AssetSource | null>(null)
  const [t, setT] = useState<{ source: AssetSource; terrain: Terrain } | null>(null)
  useEffect(() => {
    let cancelled = false
    const { aoi } = source
    const ref = aoi.rasters.dem
    const px = ref.px_m
    const cols = Math.round(aoi.size_m[0] / px)
    const rows = Math.round(aoi.size_m[1] / px)
    fetch(source.url(ref.file))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => {
        if (cancelled) return
        if (buf.byteLength !== cols * rows * 4) {
          setFailed(source)
          return
        }
        // ~80k vertices at most: smooth on a laptop GPU, fine detail at projector distance.
        const step = Math.max(1, Math.ceil(Math.sqrt((cols * rows) / 80_000)))
        const terrain = buildTerrain(new Float32Array(buf), cols, rows, px, [aoi.size_m[0], aoi.size_m[1]], step)
        setT({ source, terrain })
      })
      .catch(() => !cancelled && setFailed(source))
    return () => {
      cancelled = true
    }
  }, [source])
  const terrain = t && t.source === source ? t.terrain : null
  return { terrain, loading: terrain === null && failed !== source }
}

type Build3d = {
  source: AssetSource
  data: SiteData
  terrain: Terrain
  orthoFile: string
  envelope?: { image: HTMLCanvasElement } | null
  mission?: MissionLayers
  isVisible: (id: LayerId) => boolean
  /** Phase 0..1 for the beacon pulse. */
  pulse: number
}

/** deck.gl layers for the 3D view, bottom to top. */
export function build3dLayers({ source, data, terrain, orthoFile, envelope, mission, isVisible, pulse }: Build3d): Layer[] {
  const { aoi } = source
  const EXAG = terrain.exag
  const W = aoi.size_m[0]
  const inAoi = (p: XY) => p[0] >= 0 && p[1] >= 0 && p[0] <= aoi.size_m[0] && p[1] <= aoi.size_m[1]
  const ground = (p: XY) => {
    const z = terrain.zAt(p[0], p[1])
    return Number.isFinite(z) ? z : 0
  }
  const lift = (p: XY, extra = 0): [number, number, number] => [p[0], p[1], ground(p) + (LIFT + extra) * EXAG]
  // Vertices over no-data are dropped, so a line never dives to the floor of the scene.
  const lift3 = (path: XY[], extra = 0) =>
    path.filter((p) => Number.isFinite(terrain.zAt(p[0], p[1]))).map((p) => lift(p, extra))
  const out: Layer[] = []
  const origin = [{ position: [0, 0, 0] }]

  out.push(
    new SimpleMeshLayer({
      id: 'terrain',
      data: origin,
      mesh: terrain.mesh,
      texture: isVisible('ortho') ? source.url(orthoFile) : undefined,
      getColor: [120, 110, 100, 255],
      getPosition: (d: { position: number[] }) => d.position as [number, number, number],
      material: { ambient: 0.45, diffuse: 0.75, shininess: 8, specularColor: [40, 36, 32] },
      // Not pickable: a picking pass over the whole mesh on every mouse move made zoom and pan stutter.
      pickable: false,
    }),
  )

  if (envelope && isVisible('envelope')) {
    out.push(
      new SimpleMeshLayer({
        id: 'envelope-skin',
        data: origin,
        mesh: terrain.mesh,
        texture: envelope.image,
        getPosition: (d: { position: number[] }) => d.position as [number, number, number],
        getTranslation: [0, 0, 1.5 * EXAG],
        material: false,
        opacity: 0.6,
        parameters: { depthWriteEnabled: false },
      }),
    )
  }

  if (data.track && isVisible('track')) {
    out.push(
      new PathLayer<[number, number, number][]>({
        id: 'track-3d',
        // Only the part inside the site: the campaign track runs on beyond the AOI.
        data: linePaths(data.track).map((p) => lift3(p.filter(inAoi))).filter((p) => p.length > 1),
        getPath: (p) => p,
        getColor: [80, 220, 255, 200],
        getWidth: 2,
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
      }),
    )
  }

  const alert = mission?.alert ?? null
  if (mission?.geom && mission.geom.legs.length > 0 && isVisible('route')) {
    const { walked, ahead } = splitAt(mission.geom, mission.progress_m)
    const fade = alert ? 0.35 : 1
    const path = (id: string, paths: XY[][], color: Rgba, width: number) =>
      new PathLayer<[number, number, number][]>({
        id,
        data: paths.map((p) => lift3(p)),
        getPath: (p) => p,
        getColor: color,
        getWidth: width,
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
        opacity: fade,
      })
    out.push(
      path('route3d-ahead', ahead, [ROUTE[0], ROUTE[1], ROUTE[2], 150], 2),
      path('route3d-walked-glow', walked, [ROUTE[0], ROUTE[1], ROUTE[2], 60], 14),
      path('route3d-walked', walked, ROUTE, 3.5),
    )
  }

  if (alert?.path && alert.path.length > 1 && isVisible('thread')) {
    const thread = lift3(alert.path, 1)
    const t = (id: string, color: Rgba, width: number) =>
      new PathLayer<[number, number, number][]>({
        id,
        data: [thread],
        getPath: (p) => p,
        getColor: color,
        getWidth: width,
        widthUnits: 'pixels',
        capRounded: true,
        jointRounded: true,
      })
    out.push(t('thread3d-glow-wide', [255, 93, 108, 45], 30), t('thread3d-glow', [255, 93, 108, 100], 14), t('thread3d', THREAD, 5))
  }

  if (isVisible('places')) {
    const haven = aoi.safe_haven.xy as unknown as XY
    const numbers = mission?.numbers ?? {}
    const stops = aoi.stops.map((s) => ({ xy: s.xy as unknown as XY, name: s.name, n: numbers[s.id] ?? null }))
    const pillar = (id: string, xy: XY, color: Rgba, height: number, width: number) =>
      new LineLayer<{ a: number[]; b: number[] }>({
        id,
        data: [{ a: lift(xy), b: [xy[0], xy[1], ground(xy) + height] }],
        getSourcePosition: (d) => d.a as [number, number, number],
        getTargetPosition: (d) => d.b as [number, number, number],
        getColor: color,
        getWidth: width,
        widthUnits: 'pixels',
      })
    const pillarH = terrain.zMax * 0.6 + 0.05 * W
    out.push(
      pillar('haven-pillar-glow', haven, [HAVEN[0], HAVEN[1], HAVEN[2], alert ? 110 : 50], pillarH, 12),
      pillar('haven-pillar', haven, HAVEN, pillarH, 2.5),
      new ScatterplotLayer<{ xy: XY; n: number | null }>({
        id: 'stops3d',
        data: [...stops, { xy: haven, n: null }],
        getPosition: (d) => lift(d.xy, 2),
        billboard: true,
        getRadius: (d) => (d.n === null ? 9 : 11),
        radiusUnits: 'pixels',
        getFillColor: (d) => (d.n === null ? HAVEN : STOP),
        stroked: true,
        getLineColor: [10, 12, 14, 255],
        lineWidthUnits: 'pixels',
        getLineWidth: 2,
        updateTriggers: { getRadius: numbers },
        parameters: ON_TOP,
      }),
      new TextLayer<{ xy: XY; n: number | null }>({
        id: 'stops3d-numbers',
        data: stops.filter((s) => s.n !== null),
        getPosition: (d) => lift(d.xy, 2),
        getText: (d) => String(d.n),
        getSize: 13,
        getColor: [17, 22, 29, 255],
        fontWeight: 700,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
        parameters: ON_TOP,
      }),
      new TextLayer<{ xy: XY; name: string }>({
        id: 'stops3d-labels',
        data: [...stops, { xy: haven, name: 'Safe haven', n: null }],
        getPosition: (d) => lift(d.xy, 2),
        getText: (d) => d.name,
        getSize: 15,
        getPixelOffset: [0, -18],
        getAlignmentBaseline: 'bottom',
        getColor: [238, 243, 241, 255],
        background: true,
        getBackgroundColor: [7, 10, 12, 210],
        backgroundPadding: [6, 3],
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
        fontWeight: 600,
        characterSet: 'auto',
        parameters: ON_TOP,
      }),
    )
  }

  if (mission?.marker && isVisible('astronaut')) {
    const m = mission.marker
    const top = ground(m) + 0.07 * W
    const beam = (id: string, color: Rgba, width: number) =>
      new LineLayer<number>({
        id,
        data: [0],
        getSourcePosition: () => lift(m),
        getTargetPosition: () => [m[0], m[1], top],
        getColor: color,
        getWidth: width,
        widthUnits: 'pixels',
      })
    out.push(
      beam('astronaut-beam-glow', [SAND[0], SAND[1], SAND[2], 70], 14),
      beam('astronaut-beam', SAND, 3),
      new ScatterplotLayer<number>({
        id: 'astronaut-ring',
        data: [0],
        getPosition: () => lift(m, 1),
        billboard: true,
        getRadius: 12 + 22 * pulse,
        radiusUnits: 'pixels',
        filled: false,
        stroked: true,
        getLineColor: [SAND[0], SAND[1], SAND[2], Math.round(220 * (1 - pulse))],
        lineWidthUnits: 'pixels',
        getLineWidth: 2.5,
        updateTriggers: { getRadius: pulse, getLineColor: pulse },
      }),
      new ScatterplotLayer<number>({
        id: 'astronaut-3d',
        data: [0],
        getPosition: () => lift(m, 1),
        billboard: true,
        getRadius: 7,
        radiusUnits: 'pixels',
        getFillColor: [255, 255, 255, 255],
        stroked: true,
        getLineColor: SAND,
        lineWidthUnits: 'pixels',
        getLineWidth: 3,
      }),
      new TextLayer<number>({
        id: 'astronaut-3d-label',
        data: [0],
        getPosition: () => [m[0], m[1], top],
        getText: () => 'Astronaut · Simulation',
        getSize: 13,
        getPixelOffset: [0, -8],
        getAlignmentBaseline: 'bottom',
        getColor: [217, 168, 119, 255],
        background: true,
        getBackgroundColor: [7, 10, 12, 200],
        backgroundPadding: [6, 3],
        fontFamily: '"IBM Plex Sans", system-ui, sans-serif',
        fontWeight: 600,
        characterSet: 'auto',
        parameters: ON_TOP,
      }),
    )
  }
  return out
}
