// The map canvas: deck.gl in a non-geospatial orthographic view.
// World units are metres in the AOI plane, x east, y north, north up on screen. No basemap, no Mercator.

import { OrthographicView, type OrthographicViewState, type PickingInfo } from '@deck.gl/core'
import { DeckGL } from '@deck.gl/react'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { Provenance, WsState } from '../lib/types'
import type { AssetSource } from './assets'
import { buildLayers, layerEntries, NARROW_PX, type LayerId, type MissionLayers } from './buildLayers'
import { inAoi, type SizeM, type XY } from './coords'
import {
  marginAt,
  quantizeT,
  minutesToStorm,
  useReachableShares,
  stormMarginAt,
  useCostToHome,
  useEnvelopeImage,
} from './envelope'
import { useLayerRegistry } from './layers'
import { CursorReadout, NorthArrow, ScaleBar } from './overlays'
import { usePlanClock } from './planClock'
import {
  nextProgress,
  pointAt,
  progressAtTime,
  routeGeometry,
  selectFromPick,
  stopNumbers,
  type Progress,
  type RouteGeometry,
} from './route'
import { fitZoom, metresPerPixel } from './scale'
import { TimeBar } from './TimeBar'
import { ReplanPanel } from './ReplanPanel'
import { useReplan } from './useReplan'
import { useSiteData } from './useSiteData'
import './map.css'
import './map-theme.css'

const VIEW = new OrthographicView({ id: 'map', flipY: false, controller: true })
const MAX_ZOOM = 4 // 16 screen px per metre
const DASH_PX = 10 // dash length of the route ahead, screen pixels

type Props = { source: AssetSource; className?: string; inset?: MapInset }

const PULSE_MS = 1200

/** Phase in [0, 1) of the safe-haven pulse, ticking at 10 Hz only while active; 0 otherwise. */
function usePulse(active: boolean): number {
  const [phase, setPhase] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setPhase((Date.now() % PULSE_MS) / PULSE_MS), 100)
    return () => {
      clearInterval(id)
      setPhase(0)
    }
  }, [active])
  return active ? phase : 0
}

/** Screen pixels covered by floating panels on each side; the AOI is fitted into what is left. */
export type MapInset = { top: number; right: number; bottom: number; left: number }
const NO_INSET: MapInset = { top: 0, right: 0, bottom: 0, left: 0 }

function fittedState(width: number, height: number, size_m: SizeM, inset: MapInset = NO_INSET): OrthographicViewState {
  const zoom = fitZoom(width - inset.left - inset.right, height - inset.top - inset.bottom, size_m)
  // Centre the AOI in the free area: shift the view target by half the inset difference (y is up).
  const mpp = metresPerPixel(zoom)
  const dx = ((inset.left - inset.right) / 2) * mpp
  const dy = ((inset.top - inset.bottom) / 2) * mpp
  return {
    target: [size_m[0] / 2 - dx, size_m[1] / 2 + dy, 0],
    zoom,
    minZoom: zoom - 2,
    maxZoom: MAX_ZOOM,
  }
}

export function MapView({ source, className, inset = NO_INSET }: Props) {
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
  const selectedTarget = useMission((s) => s.selectedTarget)
  const selectTarget = useMission((s) => s.selectTarget)
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

  // Return envelope (Y5): redrawn only when the time moves by at least 0.5 min. During a storm alert
  // (Y6) it shows where home is reachable before the storm instead; the mode comes from the current
  // state alone, so clearing the alert restores the normal envelope.
  // Y9: the same envelope from the flat-ground variant (A7), to show what the terrain model changes.
  const costTerrain = useCostToHome(source)
  const costFlat = useCostToHome(source, 'cost_to_home_flat')
  const [flat, setFlat] = useState(false)
  const flatOn = flat && costFlat !== null
  const cost = flatOn ? costFlat : costTerrain
  const tNow = state ? state.t_min : planT
  const tq = quantizeT(tNow)
  // Read as primitives from the store, so the React Compiler can keep the memos below.
  const lead = useMission((s) => s.session.state?.alert?.lead_min)
  const since = useMission((s) => s.session.state?.alert?.since_t)
  const alerted = lead !== undefined && since !== undefined
  const stormLeft = alerted ? minutesToStorm(lead, since, tNow) : 0
  const stormKey = alerted ? quantizeT(stormLeft) : -1
  const { budget_min, reserve_min } = aoi.model
  const envelope = useEnvelopeImage(cost, budget_min, reserve_min, tq, stormKey)
  const envelopeProvenance: Provenance = source.synthetic ? 'Simulation' : 'Modeled'
  // Share of the site from which home is still reachable, for both variants, at the drawn time.
  const shares = useReachableShares(flatOn ? costTerrain : null, flatOn ? costFlat : null, budget_min, reserve_min, tq, stormKey)
  const cursorMargin =
    cost && cursor
      ? alerted
        ? { minutes: stormMarginAt(cost, cursor[0], cursor[1], stormLeft), provenance: envelopeProvenance, storm: true }
        : { minutes: marginAt(cost, { budget_min, reserve_min }, cursor[0], cursor[1], tNow), provenance: envelopeProvenance }
      : null

  // Storm alert (Y6): the way home as the red thread and a pulse on the safe haven.
  const pulse = usePulse(alerted)
  const abortPath = state?.abort_path ?? null
  const alertLayers = useMemo(
    () => (alerted ? { path: abortPath ? abortPath.map((p) => [p[0], p[1]] as XY) : null, pulse } : null),
    [alerted, abortPath, pulse],
  )

  // MPC-2: replanning suggestion (live session only; hidden in DEMO).
  const replan = useReplan(source)
  const hasSuggestion = replan.path !== null

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
      alert: alerted,
      flat: flatOn,
      suggestion: hasSuggestion,
    })
    const ids = entries.map((e) => e.id)
    ownIds.current.filter((id) => !ids.includes(id)).forEach(unregister)
    entries.forEach(register)
    ownIds.current = ids
  }, [source, data, register, unregister, route, hasMarker, routeProvenance, cost, alerted, flatOn, hasSuggestion])
  useEffect(() => () => ownIds.current.forEach(unregister), [unregister])

  // Keep the AOI fitted to the container until the user pans or zooms
  // (the first resize reports the canvas default size, before layout).
  const userMoved = useRef(false)

  const fit = useCallback(() => {
    if (!viewSize) return
    userMoved.current = false
    setViewState(fittedState(viewSize.width, viewSize.height, [w, h], inset))
  }, [viewSize, w, h, inset])

  const onResize = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      if (width <= 0 || height <= 0) return
      setViewSize({ width, height })
      if (!userMoved.current) setViewState(fittedState(width, height, [w, h], inset))
    },
    [w, h, inset],
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
  const zoomQ = Math.round(zoom * 4) / 4
  const dash_m = DASH_PX * metresPerPixel(zoomQ)
  const ppm = 1 / metresPerPixel(zoomQ) // screen px per metre, for label placement (Y9)

  // No layers until the real size is known, so a narrow map never downloads the big ortho first.
  const narrow = viewSize ? viewSize.width < NARROW_PX : null
  const layers = useMemo(() => {
    if (narrow === null) return []
    const visible = new Set(registered.filter((l) => l.visible).map((l) => l.id))
    const mission: MissionLayers = {
      geom,
      progress_m,
      marker,
      numbers,
      selectedStop,
      dash_m,
      alert: alertLayers,
      selectedTarget,
      suggestion: replan.path,
    }
    return buildLayers({ source, data, narrow, mission, envelope, ppm, isVisible: (id: LayerId) => visible.has(id) })
  }, [registered, source, data, narrow, geom, progress_m, marker, numbers, selectedStop, dash_m, envelope, alertLayers, selectedTarget, ppm, replan.path])

  // The stop card shows a selected target before a selected stop, so picking a stop clears the target.
  const onClick = useCallback(
    (info: PickingInfo) => {
      selectFromPick(info, { selectStop, selectTarget })
    },
    [selectStop, selectTarget],
  )

  return (
    <div
      className={`am-map ${route ? 'am-has-timebar' : ''} ${className ?? ''}`}
      style={
        {
          '--am-inset-top': `${inset.top}px`,
          '--am-inset-right': `${inset.right}px`,
          '--am-inset-bottom': `${inset.bottom}px`,
          '--am-inset-left': `${inset.left}px`,
        } as CSSProperties
      }
    >
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
      <ReplanPanel replan={replan} aoi={aoi} />
      <div className="am-overlay am-top-left">
        <span className="am-title">{aoi.name}</span>
        {source.synthetic && <span className="am-badge">SYNTHETIC fixture data</span>}
      </div>
      <div className="am-overlay am-top-right">
        <NorthArrow />
        <button type="button" className="am-button" onClick={fit}>
          Fit AOI
        </button>
        {costFlat && (
          <label className="am-compare-toggle" htmlFor="am-compare">
            <input id="am-compare" type="checkbox" checked={flat} onChange={(e) => setFlat(e.target.checked)} />
            Without the terrain model
          </label>
        )}
      </div>
      {shares && (
        <div className="am-overlay am-compare-caption" data-testid="compare-caption">
          <span>
            {alerted ? 'Home before the storm' : 'Can still get home'} at T+{tq.toFixed(1)} min:{' '}
            <b>{Math.round(shares.terrain * 100)} %</b> of the site with the terrain model ·{' '}
            <b>{Math.round(shares.flat * 100)} %</b> on flat ground
          </span>
          <span className={`am-prov am-prov-${envelopeProvenance.toLowerCase()}`}>{envelopeProvenance}</span>
        </div>
      )}
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
