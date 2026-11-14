// Zoom and scale helpers for the orthographic view.
// deck.gl OrthographicView: one world unit (1 m) spans 2^zoom screen pixels.

import type { SizeM } from './coords'

export function metresPerPixel(zoom: number): number {
  return Math.pow(2, -zoom)
}

export type ScaleBar = { metres: number; px: number; label: string }

/** Longest 1-2-5 length (in metres) whose bar fits in maxPx pixels. */
export function niceScaleBar(mpp: number, maxPx = 120): ScaleBar {
  const maxMetres = mpp * maxPx
  const exp = Math.floor(Math.log10(maxMetres))
  let metres = Math.pow(10, exp)
  for (const step of [5, 2, 1]) {
    const candidate = step * Math.pow(10, exp)
    if (candidate <= maxMetres) {
      metres = candidate
      break
    }
  }
  const label =
    metres >= 1000 ? `${metres / 1000} km` : metres >= 1 ? `${metres} m` : `${Math.round(metres * 100)} cm`
  return { metres, px: metres / mpp, label }
}

/** Zoom at which the whole AOI fits a viewW x viewH viewport, leaving `padding` px on every side. */
export function fitZoom(viewW: number, viewH: number, size_m: SizeM, padding = 24): number {
  const w = Math.max(viewW - 2 * padding, 1)
  const h = Math.max(viewH - 2 * padding, 1)
  return Math.log2(Math.min(w / size_m[0], h / size_m[1]))
}
