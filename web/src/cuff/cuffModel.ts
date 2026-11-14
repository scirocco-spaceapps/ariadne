// Pure numbers for the cuff: where to walk next, how much budget is left, and the margin colours.
// Route geometry comes from the map (Y4), the margin from the envelope (Y5), so the cuff and the
// map always agree.
import type { Budget } from '../app/store'
import type { RouteResponse, WsState } from '../lib/types'
import { ENVELOPE_COLORS, progressFromState, routeGeometry, type MarginClass, type XY } from '../map'
import { pathLength, projectOnPath } from '../map/route'

export interface NextTarget {
  id: string
  kind: 'stop' | 'haven'
  /** Metres along the plan (or the abort path) still to walk. */
  distance_m: number
  /** Minutes until arrival; null when the model cannot say (walking home: see the return time). */
  eta_min: number | null
  /** Dwelling there now. */
  here: boolean
}

/**
 * The place the astronaut walks to now. Alert: the safe haven along abort_path. At a stop: that
 * stop. On a leg: the leg's end, with the distance left along the planned path and the planned
 * arrival time. Before the start: the first stop. After the last leg: null (home).
 */
export function nextTarget(route: RouteResponse | null, state: WsState | null): NextTarget | null {
  if (!state) return null
  const pos: XY = [state.pos[0], state.pos[1]]
  const haven = route?.legs[0]?.from ?? 'haven'

  if (state.alert) {
    const path = (state.abort_path ?? []).map((p) => [p[0], p[1]] as XY)
    const left = path.length > 1 ? pathLength(path) - projectOnPath(path, pos) : 0
    return { id: haven, kind: 'haven', distance_m: Math.max(0, left), eta_min: null, here: left < 2 }
  }
  if (!route || route.legs.length === 0) return null
  if (state.at_stop) {
    return { id: state.at_stop, kind: state.at_stop === haven ? 'haven' : 'stop', distance_m: 0, eta_min: 0, here: true }
  }

  // Back at the safe haven after the walk began (an alert sent the astronaut home): no next stop.
  const havenXY = route.legs[0].path[0]
  const started = state.t_min > 0 || state.visited.length > 0
  if (started && state.leg === null && havenXY && Math.hypot(pos[0] - havenXY[0], pos[1] - havenXY[1]) < 5) {
    return null
  }

  const g = routeGeometry(route)
  const s = progressFromState(g, state)
  let i = state.leg
  if (i === null) {
    // Not walking a leg: before the start, or between the end of a dwell and the next leg.
    i = g.legs.findIndex((l) => l.start + l.length > s + 1)
    if (i < 0) return null // the whole route is walked: home
  }
  const leg = g.legs[i]
  if (!leg) return null
  const walk = route.timeline.find((t) => t.kind === 'walk' && t.leg === i)
  const distance = Math.max(0, leg.start + leg.length - s)
  return {
    id: leg.to,
    kind: leg.to === haven ? 'haven' : 'stop',
    distance_m: distance,
    eta_min: walk ? Math.max(0, walk.t1_min - state.t_min) : null,
    here: false,
  }
}

export interface BudgetView {
  left_min: number
  reserve_min: number
  /** Share of the budget left, 0..1. */
  frac: number
  /** Where the reserve starts on the same bar, 0..1. */
  reserveFrac: number
}

/** Consumables left: budget minus EVA time, against the reserve. */
export function budgetLeft(t_min: number, budget: Budget): BudgetView {
  const left = budget.budget_min - t_min
  const total = Math.max(budget.budget_min, 1)
  return {
    left_min: left,
    reserve_min: budget.reserve_min,
    frac: Math.min(1, Math.max(0, left / total)),
    reserveFrac: Math.min(1, Math.max(0, budget.reserve_min / total)),
  }
}

/** Minutes to walk home from here, recovered from the margin (margin = budget - t - reserve - cost). */
export function costAt(margin: number, t_min: number, budget: Budget): number {
  return budget.budget_min - t_min - budget.reserve_min - margin
}

/** Margin colour on the black cuff: the map's safe and tight colours, the alert red for out. */
export const ALERT_RED = '#ff5d6c'
export function marginColour(cls: MarginClass): string {
  return cls === 'out' ? ALERT_RED : ENVELOPE_COLORS[cls]
}

export const MARGIN_LABEL: Record<MarginClass, string> = {
  safe: 'Safe to continue',
  tight: 'Tight: inside the reserve',
  out: 'Cannot get back in time',
}

/** Minutes for the cuff: "+142 min", "−8 min". */
export function signedMin(v: number): string {
  const r = Math.round(v)
  return `${r >= 0 ? '+' : '−'}${Math.abs(r)} min`
}

/** Minutes as "m:ss". */
export function minSec(min: number): string {
  const total = Math.max(0, Math.round(min * 60))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Metres for walking: "420 m", "1.4 km". */
export function walkDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`
}

/** Stops and return-home flag the console planned, for the pairing URL and the cuff's own plan. */
export function routeStops(route: RouteResponse): { stops: string[]; home: boolean } {
  const haven = route.legs[0]?.from
  const stops = route.legs.map((l) => l.to).filter((id) => id !== haven)
  const home = route.legs.length > 0 && route.legs[route.legs.length - 1].to === haven
  return { stops, home }
}
