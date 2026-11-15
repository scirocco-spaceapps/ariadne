// Mission-control sends the astronaut's state twice a second (ws-messages.md: "clients interpolate").
// The map eases the astronaut marker and the walked part of the route from the last shown value to
// each new one over about one update interval, so they glide instead of jumping. Numbers on screen
// (clocks, margins, the cuff) are not touched: they stay exactly what the state says.

import { useEffect, useRef, useState } from 'react'
import type { XY } from './coords'

export type Smoothable = { marker: XY | null; s: number }

/** Larger jumps than these (a seek, a reset, a new session, the walk home) snap instead of gliding. */
const SNAP_M = 250
const MIN_MS = 100
const MAX_MS = 900

function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

function dist(a: XY, b: XY): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/**
 * The target, eased over the interval between its last two changes. With `enabled` false (no running
 * session, automated tests, reduced motion) it returns the target as is.
 */
export function useSmoothed(target: Smoothable, enabled: boolean): Smoothable {
  const [shown, setShown] = useState<Smoothable>(target)
  const shownRef = useRef<Smoothable>(target)
  const lastChange = useRef(0)
  const tx = target.marker ? target.marker[0] : NaN
  const ty = target.marker ? target.marker[1] : NaN
  const ts = target.s

  useEffect(() => {
    const to: Smoothable = { marker: Number.isFinite(tx) ? [tx, ty] : null, s: ts }
    const from = shownRef.current
    const now = performance.now()
    const interval = now - lastChange.current
    lastChange.current = now
    const snap =
      !enabled ||
      !from.marker ||
      !to.marker ||
      dist(from.marker, to.marker) > SNAP_M ||
      to.s < from.s - 1 ||
      to.s - from.s > SNAP_M
    if (snap) {
      shownRef.current = to
      setShown(to)
      return
    }
    const dur = Math.min(MAX_MS, Math.max(MIN_MS, interval))
    const fm = from.marker
    const tm = to.marker
    let raf = 0
    const tick = () => {
      // performance.now(), not the rAF timestamp: that one is the frame's start and can be earlier
      // than `now`, which gave a negative k and threw the marker backwards.
      const k = Math.min(1, Math.max(0, (performance.now() - now) / dur))
      const v: Smoothable = { marker: [lerp(fm[0], tm[0], k), lerp(fm[1], tm[1], k)], s: lerp(from.s, to.s, k) }
      shownRef.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [tx, ty, ts, enabled])

  return enabled ? shown : target
}
