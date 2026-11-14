// Route geometry for the map (Y4): where the astronaut is along the planned walk, which part is
// walked, and the time each stop is reached. Pure functions; positions are AOI metres [x, y].

import type { PickingInfo } from '@deck.gl/core'
import type { RouteResponse, WsState } from '../lib/types'
import type { XY } from './coords'

export type LegGeometry = {
  from: string
  to: string
  path: XY[]
  /** Geometric length of the path in metres. */
  length: number
  /** Distance along the whole route where this leg starts. */
  start: number
}

export type RouteGeometry = { legs: LegGeometry[]; total: number }

const dist = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1])
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function pathLength(path: XY[]): number {
  let l = 0
  for (let i = 1; i < path.length; i++) l += dist(path[i - 1], path[i])
  return l
}

export function routeGeometry(route: RouteResponse): RouteGeometry {
  let start = 0
  const legs = route.legs.map((leg) => {
    const path = leg.path.map((p) => [p[0], p[1]] as XY)
    const length = pathLength(path)
    const g = { from: leg.from, to: leg.to, path, length, start }
    start += length
    return g
  })
  return { legs, total: start }
}

/** Point at distance d along a polyline, clamped to its ends. */
export function alongPath(path: XY[], d: number): XY {
  if (path.length === 0) return [0, 0]
  let left = Math.max(0, d)
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const l = dist(a, b)
    if (left <= l && l > 0) {
      const f = left / l
      return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]
    }
    left -= l
  }
  const last = path[path.length - 1]
  return [last[0], last[1]]
}

/** Distance along the polyline of the point on it nearest to p. */
export function projectOnPath(path: XY[], p: XY): number {
  let best = Infinity
  let bestAlong = 0
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    const l = dist(a, b)
    const f = l > 0 ? clamp(((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (l * l), 0, 1) : 0
    const q: XY = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]
    const d = dist(p, q)
    if (d < best) {
      best = d
      bestAlong = walked + f * l
    }
    walked += l
  }
  return bestAlong
}

/** Position at distance s along the whole route; null for a route without legs. */
export function pointAt(g: RouteGeometry, s: number): XY | null {
  if (g.legs.length === 0) return null
  const leg = g.legs.find((l) => s <= l.start + l.length) ?? g.legs[g.legs.length - 1]
  return alongPath(leg.path, s - leg.start)
}

/** The polyline from distance a to distance b along one path (a < b). */
function subPath(path: XY[], a: number, b: number): XY[] {
  const out: XY[] = [alongPath(path, a)]
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    walked += dist(path[i - 1], path[i])
    if (walked > a && walked < b) out.push([path[i][0], path[i][1]])
  }
  out.push(alongPath(path, b))
  return out
}

/** Walked and remaining parts of the route at distance s, one path per leg piece. */
export function splitAt(g: RouteGeometry, s: number): { walked: XY[][]; ahead: XY[][] } {
  const walked: XY[][] = []
  const ahead: XY[][] = []
  for (const leg of g.legs) {
    const local = s - leg.start
    if (local >= leg.length) walked.push(leg.path)
    else if (local <= 0) ahead.push(leg.path)
    else {
      walked.push(subPath(leg.path, 0, local))
      ahead.push(subPath(leg.path, local, leg.length))
    }
  }
  return { walked, ahead }
}

/** A polyline cut into dash segments of dash_m, gap_m apart (dashed line without extensions). */
export function dashes(path: XY[], dash_m: number, gap_m: number): XY[][] {
  const total = pathLength(path)
  if (!(dash_m > 0) || total === 0) return path.length >= 2 ? [path] : []
  const out: XY[][] = []
  for (let a = 0; a < total; a += dash_m + Math.max(gap_m, 0)) {
    out.push(subPath(path, a, Math.min(a + dash_m, total)))
  }
  return out
}

/** Distance along the route at plan time t (planning mode), from the route timeline. */
export function progressAtTime(route: RouteResponse, g: RouteGeometry, t: number): number {
  let s = 0
  for (const item of route.timeline) {
    if (t < item.t0_min) return s
    if (item.kind === 'walk' && item.leg !== undefined && g.legs[item.leg]) {
      const leg = g.legs[item.leg]
      const span = item.t1_min - item.t0_min
      if (t < item.t1_min && span > 0) return leg.start + ((t - item.t0_min) / span) * leg.length
      s = leg.start + leg.length
    } else if (t < item.t1_min) {
      return s
    }
  }
  return s
}

const legEnd = (g: RouteGeometry, i: number) => g.legs[i].start + g.legs[i].length
const legTo = (g: RouteGeometry, stop: string) => g.legs.findIndex((l) => l.to === stop)

/** Distance along the route that one session state shows (see contracts/ws-messages.md). */
export function progressFromState(g: RouteGeometry, state: WsState): number {
  if (g.legs.length === 0) return 0
  const pos: XY = [state.pos[0], state.pos[1]]
  if (state.leg !== null && g.legs[state.leg]) {
    const leg = g.legs[state.leg]
    return leg.start + projectOnPath(leg.path, pos)
  }
  if (state.at_stop) {
    const i = legTo(g, state.at_stop)
    if (i >= 0) return legEnd(g, i)
  }
  // Not walking the plan: before the start, on the abort path, or after the end.
  const stops = g.legs.slice(0, -1).map((l) => l.to)
  const last = g.legs[g.legs.length - 1]
  const finished =
    stops.every((id) => state.visited.includes(id)) &&
    state.visited.length > 0 &&
    dist(pos, last.path[last.path.length - 1]) < 2
  if (finished) return g.total
  const lastVisited = state.visited[state.visited.length - 1]
  const i = lastVisited ? legTo(g, lastVisited) : -1
  return i >= 0 ? legEnd(g, i) : 0
}

export type Progress = { geom: RouteGeometry; session: string; t_min: number; s: number }

/**
 * Progress for the next state. Within one run of one session it never goes back, so the walked part
 * stays solid while an alert sends the astronaut home on abort_path (leg null, the current stop not
 * yet in visited). A new route, a new session or time going backwards (DEMO loop, reset, seek) starts
 * again from the state alone.
 */
export function nextProgress(prev: Progress | null, g: RouteGeometry, state: WsState): Progress {
  const s = progressFromState(g, state)
  const sameRun = prev !== null && prev.geom === g && prev.session === state.session && state.t_min >= prev.t_min
  return { geom: g, session: state.session, t_min: state.t_min, s: sameRun ? Math.max(prev.s, s) : s }
}

/** Visiting order of the stops: { stopId: 1..n }; the safe haven (start and end) has no number. */
export function stopNumbers(route: RouteResponse): Record<string, number> {
  const out: Record<string, number> = {}
  const haven = route.legs[0]?.from
  let n = 0
  for (const leg of route.legs) {
    if (leg.to !== haven && !(leg.to in out)) out[leg.to] = ++n
  }
  return out
}

export type StopTick = { stop: string; n: number | null; t_min: number }

/** When each place is reached: one tick per walk end, numbered like the stop markers. */
export function arrivalTicks(route: RouteResponse): StopTick[] {
  const numbers = stopNumbers(route)
  return route.timeline.flatMap((item) => {
    if (item.kind !== 'walk' || item.leg === undefined) return []
    const leg = route.legs[item.leg]
    return leg ? [{ stop: leg.to, n: numbers[leg.to] ?? null, t_min: item.t1_min }] : []
  })
}

/** Stop id of a clicked stop marker; null for the safe haven or anything else. */
export function stopIdFromPick(info: Pick<PickingInfo, 'layer' | 'object'>): string | null {
  if (info.layer?.id !== 'places') return null
  const o = info.object as { id?: unknown; haven?: unknown } | undefined
  return o && typeof o.id === 'string' && !o.haven ? o.id : null
}

/** Target id of a clicked B3 target marker (Y7); null for anything else. */
export function targetIdFromPick(info: Pick<PickingInfo, 'layer' | 'object'>): string | null {
  if (info.layer?.id !== 'targets') return null
  const o = info.object as { id?: unknown } | undefined
  return o && typeof o.id === 'string' ? o.id : null
}

/**
 * Applies a map click to the selection: a target sets selectedTarget; a stop clears the target (the
 * stop card shows a selected target first) and sets selectedStop. Returns true when something was picked.
 */
export function selectFromPick(
  info: Pick<PickingInfo, 'layer' | 'object'>,
  actions: { selectStop: (id: string | null) => void; selectTarget: (id: string | null) => void },
): boolean {
  const target = targetIdFromPick(info)
  if (target) {
    actions.selectTarget(target)
    return true
  }
  const stop = stopIdFromPick(info)
  if (!stop) return false
  actions.selectTarget(null)
  actions.selectStop(stop)
  return true
}

/** EVA clock as "T+ h:mm". */
export function evaClockLabel(min: number): string {
  const m = Math.max(0, Math.round(min))
  return `T+ ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
