// The map canvas: deck.gl in a non-geospatial orthographic view.
// World units are metres in the AOI plane, x east, y north, north up on screen. No basemap, no Mercator.

import { OrthographicView, type OrthographicViewState, type PickingInfo } from '@deck.gl/core'
import { DeckGL } from '@deck.gl/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { Provenance, WsState } from '../lib/types'
import type { AssetSource } from './assets'
import { buildLayers, layerEntries, NARROW_PX, type LayerId, type MissionLayers } from './buildLayers'
import { inAoi, type SizeM, type XY } from './coords'
import { envelopeCanvas, marginAt, quantizeT, useCostToHome } from './envelope'
import { useLayerRegistry } from './layers'
import { CursorReadout, NorthArrow, ScaleBar } from './overlays'
import { usePlanClock } from './planClock'
import {
  nextProgress,
  pointAt,
  progressAtTime,
  routeGeometry,
  stopIdFromPick,
  stopNumbers,
  type Progress,
  type RouteGeometry,
} from './route'
import { fitZoom, metresPerPixel } from './scale'
import { TimeBar } from './TimeBar'
import { useSiteData } from './useSiteData'
import './map.css'

const VIEW = new OrthographicView({ id: 'map', flipY: false, controller: true })
const MAX_ZOOM = 4 // 16 screen px per metre
const DASH_PX = 10 // dash length of the route ahead, screen pixels

type Props = { source: AssetSource; className?: string }

function fittedState(width: number, height: number, size_m: SizeM): OrthographicViewState {
  const zoom = fitZoom(width, height, size_m)
  return {
    target: [size_m[0] / 2, size_m[1] / 2, 0],
    zoom,
    minZoom: zoom - 2,
    maxZoom: MAX_ZOOM,
  }
}

export function MapView({ source, className }: Props) {
  const { aoi } = source
  const [w, h] = aoi.size_m

  const [viewSize, setViewSize] = useState<{ width: number; height: number } | null>(null)
  const [viewState, setViewState] = useState<OrthographicViewState>(() => fittedState(800, 600, [w, h]))
  const [cursor, setCursor] = useState<XY | null>(null)

  const data = useSiteData(source)

  // Mission state (Y4): the planned route, the session state, the selected stop and the plan clock.
  const route = useMission((s) => s.route)
  const state = useMission((s) => s.session.state)
  const selectedStop = useMission((s) => s.selectedStop)
  const selectStop = useMission((s) => s.selectStop)
  const planT = usePlanClock((s) => s.t_min)
  const geom = useMemo(() => (route ? routeGeometry(route) : null), [route])
  const numbers = useMemo(() => (route ? stopNumbers(route) : {}), [route])
  const routeProvenance: Provenance =
    source.synthetic || route === fixtures.route ? 'Simulation' : (route?.provenance ?? 'Modeled')
  useEffect(() => usePlanClock.getState().setT(0), [route])

  // With a session the state drives the marker and the walked part (kept monotonic per run, so the
  // last state and its progress are remembered); without one the plan clock does (planning mode).
  const [run, setRun] = useState<{ state: WsState | null; geom: RouteGeometry | null; p: Progress | null }>({
    state: null,
    geom: null,
    p: null,
  })
  const fresh = state !== run.state || geom !== run.geom
  const sessionProgress = state && geom ? (fresh ? nextProgress(run.p, geom, state) : run.p) : null
  if (fresh) setRun({ state, geom, p: sessionProgress }) // adjust state while rendering (React docs pattern)
  const progress_m = !geom || !route ? 0 : sessionProgress ? sessionProgress.s : progressAtTime(route, geom, planT)
  const marker = useMemo<XY | null>(
    () => (state ? [state.pos[0], state.pos[1]] : geom ? pointAt(geom, progress_m) : null),
    [state, geom, progress_m],
  )
  const hasMarker = marker !== null

  // Return envelope (Y5): redrawn only when the time moves by at least 0.5 min.
  const cost = useCostToHome(source)
  const tNow = state ? state.t_min : planT
  const tq = quantizeT(tNow)
  const { budget_min, reserve_min } = aoi.model
  const envelope = useMemo(() => {
    if (!cost) return null
    const image = envelopeCanvas(cost, { budget_min, reserve_min }, tq)
    return image ? { image } : null
  }, [cost, tq, budget_min, reserve_min])
  const envelopeProvenance: Provenance = source.synthetic ? 'Simulation' : 'Modeled'
  const cursorMargin =
    cost && cursor
      ? { minutes: marginAt(cost, { budget_min, reserve_min }, cursor[0], cursor[1], tNow), provenance: envelopeProvenance }
      : null

  const registered = useLayerRegistry((s) => s.layers)
  const register = useLayerRegistry((s) => s.register)
  const unregister = useLayerRegistry((s) => s.unregister)

  // Register every layer whose data is present and drop the ones that disappeared. Re-registering
  // keeps each layer's visibility, so data arriving later does not reset the user's toggles.
  const ownIds = useRef<string[]>([])
  useEffect(() => {
    const entries = layerEntries(source, data, {
      route: route !== null,
      astronaut: hasMarker,
      routeProvenance,
      envelope: cost !== null,
    })
    const ids = entries.map((e) => e.id)
    ownIds.current.filter((id) => !ids.includes(id)).forEach(unregister)
    entries.forEach(register)
    ownIds.current = ids
  }, [source, data, register, unregister, route, hasMarker, routeProvenance, cost])
  useEffect(() => () => ownIds.current.forEach(unregister), [unregister])

  // Keep the AOI fitted to the container until the user pans or zooms
  // (the first resize reports the canvas default size, before layout).
  const userMoved = useRef(false)

  const fit = useCallback(() => {
    if (!viewSize) return
    userMoved.current = false
    setViewState(fittedState(viewSize.width, viewSize.height, [w, h]))
  }, [viewSize, w, h])

  const onResize = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      if (width <= 0 || height <= 0) return
      setViewSize({ width, height })
      if (!userMoved.current) setViewState(fittedState(width, height, [w, h]))
    },
    [w, h],
  )

  const onHover = useCallback(
    (info: PickingInfo) => {
      const c = info.coordinate
      setCursor(c && inAoi([c[0], c[1]], [w, h]) ? [c[0], c[1]] : null)
    },
    [w, h],
  )

  const zoom = typeof viewState.zoom === 'number' ? viewState.zoom : viewState.zoom?.[0] ?? 0
  // Dashes stay about DASH_PX on screen; zoom is quantised so panning does not rebuild them.
  const dash_m = DASH_PX * metresPerPixel(Math.round(zoom * 4) / 4)

  // No layers until the real size is known, so a narrow map never downloads the big ortho first.
  const narrow = viewSize ? viewSize.width < NARROW_PX : null
  const layers = useMemo(() => {
    if (narrow === null) return []
    const visible = new Set(registered.filter((l) => l.visible).map((l) => l.id))
    const mission: MissionLayers = { geom, progress_m, marker, numbers, selectedStop, dash_m }
    return buildLayers({ source, data, narrow, mission, envelope, isVisible: (id: LayerId) => visible.has(id) })
  }, [registered, source, data, narrow, geom, progress_m, marker, numbers, selectedStop, dash_m, envelope])

  const onClick = useCallback(
    (info: PickingInfo) => {
      const id = stopIdFromPick(info)
      if (id) selectStop(id)
    },
    [selectStop],
  )

  return (
    <div className={`am-map ${route ? 'am-has-timebar' : ''} ${className ?? ''}`}>
      <DeckGL
        views={VIEW}
        viewState={viewState}
        onViewStateChange={({ viewState: next, interactionState }) => {
          if (interactionState.isDragging || interactionState.isZooming || interactionState.isPanning) {
            userMoved.current = true
          }
          setViewState(next as OrthographicViewState)
        }}
        layers={layers}
        onHover={onHover}
        onClick={onClick}
        onResize={onResize}
        getCursor={({ isDragging, isHovering }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'crosshair')}
      />
      <div className="am-overlay am-top-left">
        <span className="am-title">{aoi.name}</span>
        {source.synthetic && <span className="am-badge">SYNTHETIC fixture data</span>}
      </div>
      <div className="am-overlay am-top-right">
        <NorthArrow />
        <button type="button" className="am-button" onClick={fit}>
          Fit AOI
        </button>
      </div>
      <div className="am-overlay am-bottom-left">
        <ScaleBar zoom={zoom} />
        <CursorReadout xy={cursor} margin={cursorMargin} />
      </div>
      {route && (
        <div className="am-overlay am-bottom-center">
          <TimeBar route={route} state={state} provenance={routeProvenance} />
        </div>
      )}
    </div>
  )
}
