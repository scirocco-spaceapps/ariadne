// Map furniture drawn over the deck.gl canvas: scale bar, north arrow, cursor readout.

import type { XY } from './coords'
import { metresPerPixel, niceScaleBar } from './scale'

export function ScaleBar({ zoom, maxPx = 120 }: { zoom: number; maxPx?: number }) {
  const bar = niceScaleBar(metresPerPixel(zoom), maxPx)
  return (
    <div className="am-scale" aria-label={`Scale bar: ${bar.label}`}>
      <div className="am-scale-bar" style={{ width: `${Math.round(bar.px)}px` }} />
      <span className="am-scale-label">{bar.label}</span>
    </div>
  )
}

export function NorthArrow() {
  // The view never rotates: north is always up.
  return (
    <svg className="am-north" viewBox="0 0 24 32" width="24" height="32" role="img" aria-label="North is up">
      <path d="M12 2 L20 22 L12 17 L4 22 Z" fill="currentColor" />
      <text x="12" y="31" textAnchor="middle" fontSize="9" fill="currentColor">
        N
      </text>
    </svg>
  )
}

export function CursorReadout({ xy }: { xy: XY | null }) {
  return (
    <div className="am-readout" aria-live="off">
      {xy ? `x ${xy[0].toFixed(1)} m · y ${xy[1].toFixed(1)} m` : 'x — · y —'}
    </div>
  )
}
