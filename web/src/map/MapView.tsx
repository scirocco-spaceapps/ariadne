// The map canvas: deck.gl in a non-geospatial orthographic view.
// World units are metres in the AOI plane, x east, y north, north up on screen. No basemap, no Mercator.

import { OrthographicView, type OrthographicViewState, type PickingInfo } from '@deck.gl/core'
import { DeckGL } from '@deck.gl/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssetSource } from './assets'
import { buildLayers, layerEntries, NARROW_PX, type LayerId } from './buildLayers'
import { inAoi, type SizeM, type XY } from './coords'
import { useLayerRegistry } from './layers'
import { CursorReadout, NorthArrow, ScaleBar } from './overlays'
import { fitZoom } from './scale'
import { useSiteData } from './useSiteData'
import './map.css'

const VIEW = new OrthographicView({ id: 'map', flipY: false, controller: true })
const MAX_ZOOM = 4 // 16 screen px per metre

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
  const registered = useLayerRegistry((s) => s.layers)
  const register = useLayerRegistry((s) => s.register)
  const unregister = useLayerRegistry((s) => s.unregister)

  // Register every layer whose data is present and drop the ones that disappeared. Re-registering
  // keeps each layer's visibility, so data arriving later does not reset the user's toggles.
  const ownIds = useRef<string[]>([])
  useEffect(() => {
    const entries = layerEntries(source, data)
    const ids = entries.map((e) => e.id)
    ownIds.current.filter((id) => !ids.includes(id)).forEach(unregister)
    entries.forEach(register)
    ownIds.current = ids
  }, [source, data, register, unregister])
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

  // No layers until the real size is known, so a narrow map never downloads the big ortho first.
  const narrow = viewSize ? viewSize.width < NARROW_PX : null
  const layers = useMemo(() => {
    if (narrow === null) return []
    const visible = new Set(registered.filter((l) => l.visible).map((l) => l.id))
    return buildLayers({ source, data, narrow, isVisible: (id: LayerId) => visible.has(id) })
  }, [registered, source, data, narrow])

  const zoom = typeof viewState.zoom === 'number' ? viewState.zoom : viewState.zoom?.[0] ?? 0

  return (
    <div className={`am-map ${className ?? ''}`}>
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
        onResize={onResize}
        getCursor={({ isDragging }) => (isDragging ? 'grabbing' : 'crosshair')}
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
        <CursorReadout xy={cursor} />
      </div>
    </div>
  )
}
