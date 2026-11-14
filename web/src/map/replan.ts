// Receding-horizon replanning (MPC-2): a suggestion on the console, never an order. A line-by-line
// port of Bunyamin's rule, `decide()` in notebooks/replanning.py (MPC-1); the rule in words is
// docs/model.md, "Replanning". Tests reproduce notebooks/out/replanning_cases.json.
//
//   deadline     = budget_min - leak_min - reserve_min
//   D            = (lead + legs between kept stops + leg home) / speed_factor + remaining dwells
//   margin       = deadline - (t + D)     (negative: the reserve is in use)
//   reserve_left = reserve_min + margin

import type { Aoi, RouteResponse, WsState } from '../lib/types'
import type { XY } from './coords'
import { pathLength, projectOnPath } from './route'

export const HAVEN = 'haven'

/** model/params.json replan_interval_min and min_dwell_min (Assumed); pinned by replan.test.ts. */
export const REPLAN_INTERVAL_MIN = 5
export const MIN_DWELL_MIN = 10

/** The console's what-if controls, from the cases file's `console` block (Simulation); pinned by tests. */
export const REPLAN_CONTROLS = {
  speed_factor: { default: 0.5, min: 0.3, max: 1.0, step: 0.1 },
  leak_min: { default: 120, min: 0, max: 180, step: 10 },
} as const

/** Nominal walking minutes legs[from][to]: stop -> later stop in plan order, stop -> haven. */
export type Legs = Record<string, Record<string, number>>

export type ReplanParams = { budget_min: number; reserve_min: number; dwell_min: number; min_dwell_min: number }

export type ReplanInput = {
  t_min: number
  /** The stop the astronaut is at, or walking to. */
  current_stop: string
  /** Nominal minutes still to walk to current_stop (0 when there). */
  lead_min?: number
  /** Minutes already spent at current_stop. */
  dwell_done_min?: number
  /** Stop ids after current_stop, plan order. */
  remaining: string[]
  /** Nominal cost_to_home at the astronaut's position. */
  home_now_min: number
  speed_factor?: number
  leak_min?: number
  storm_alert?: boolean
}

export type ReplanAction = 'none' | 'shorten_dwells' | 'drop_stops' | 'go_home_now'

export type ReplanResult = {
  action: ReplanAction
  reason: 'plan_fits' | 'storm_alert' | null
  deadline_min: number
  kept: string[]
  dropped: string[]
  dwell_min: number
  end_min: number
  margin_min: number
  reserve_left_min: number
}

const round2 = (v: number) => Math.round(v * 100) / 100

/** Nominal walking minutes (speed factor 1): lead to `start`, then start -> kept stops -> haven. */
export function walkTime(start: string, kept: string[], lead_min: number, legs: Legs): number {
  let t = lead_min
  let at = start
  for (const s of kept) {
    t += legs[at][s]
    at = s
  }
  return t + legs[at][HAVEN]
}

/**
 * Longest equal dwell d, whole minutes from dwell_min down to min_dwell_min, such that the n remaining
 * dwells fit in `spare`. The first one (current stop) already ran for `done` minutes.
 */
export function longestDwell(spare: number, n: number, done: number, p: ReplanParams): number | null {
  for (let d = Math.floor(p.dwell_min); d >= p.min_dwell_min; d--) {
    if (Math.max(0, d - done) + (n - 1) * d <= spare + 1e-9) return d
  }
  return null
}

/** Subsets of `items` of size k, in itertools.combinations order (earlier items kept first). */
export function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = []
  const pick = (from: number, acc: T[]) => {
    if (acc.length === k) {
      out.push(acc.slice())
      return
    }
    for (let i = from; i <= items.length - (k - acc.length); i++) {
      acc.push(items[i])
      pick(i + 1, acc)
      acc.pop()
    }
  }
  pick(0, [])
  return out
}

/** The suggestion for the rest of the walk (notebooks/replanning.py `decide`). */
export function decide(state: ReplanInput, legs: Legs, p: ReplanParams): ReplanResult {
  const t = state.t_min
  const f = state.speed_factor ?? 1
  const deadline = p.budget_min - (state.leak_min ?? 0) - p.reserve_min
  const start = state.current_stop
  const rem = state.remaining.slice()
  const lead = state.lead_min ?? 0
  const done = state.dwell_done_min ?? 0

  const out = (action: ReplanAction, reason: ReplanResult['reason'], kept: string[], dwell: number, need: number) => {
    const margin = deadline - (t + need)
    return {
      action,
      reason,
      deadline_min: round2(deadline),
      kept,
      dropped: rem.filter((s) => !kept.includes(s)),
      dwell_min: dwell,
      end_min: round2(t + need),
      margin_min: round2(margin),
      reserve_left_min: round2(p.reserve_min + margin),
    }
  }
  const need = (kept: string[], d: number) => walkTime(start, kept, lead, legs) / f + Math.max(0, d - done) + kept.length * d

  // A storm alert already sends the astronaut home (mission-control abort): no suggestion on top.
  if (state.storm_alert) return out('none', 'storm_alert', rem, p.dwell_min, need(rem, p.dwell_min))

  for (let k = 0; k <= rem.length; k++) {
    let best: { key: [number, number]; kept: string[]; d: number } | null = null
    // Combinations come earlier-stops-first; only a strictly better (dwell, margin) replaces the
    // best, so a tie keeps the earlier stops.
    for (const kept of combinations(rem, rem.length - k)) {
      const w = walkTime(start, kept, lead, legs) / f
      const d = longestDwell(deadline - t - w, 1 + kept.length, done, p)
      if (d === null) continue
      const key: [number, number] = [d, round2(deadline - (t + need(kept, d)))]
      if (best === null || key[0] > best.key[0] || (key[0] === best.key[0] && key[1] > best.key[1])) {
        best = { key, kept, d }
      }
    }
    if (best) {
      const { kept, d } = best
      if (k === 0 && d === p.dwell_min) return out('none', 'plan_fits', kept, d, need(kept, d))
      return out(k === 0 ? 'shorten_dwells' : 'drop_stops', null, kept, d, need(kept, d))
    }
  }
  return out('go_home_now', null, [], 0, state.home_now_min / f)
}

/** lead_min = leg time x remaining path length / leg path length, from the nearest point of the path. */
export function leadOnLeg(path: XY[], pos: XY, legTimeMin: number): number {
  const total = pathLength(path)
  return total > 0 ? (legTimeMin * (total - projectOnPath(path, pos))) / total : 0
}

/** Stops of a route in visiting order (the safe haven excluded). */
export function routeStops(route: RouteResponse): string[] {
  const haven = route.legs[0]?.from
  return route.legs.map((l) => l.to).filter((s) => s !== haven)
}

/** Live inputs for `decide` that come from the session; null when the rule has nothing to check. */
export type SessionReplan = Omit<ReplanInput, 'speed_factor' | 'leak_min' | 'home_now_min'> & { pos: XY }

/**
 * Where the astronaut is in the plan: the stop being dwelt at or walked to, the walk left to it,
 * the dwell already spent and the stops after it that are not visited. Null before a state, while
 * walking the last leg home, or when the plan has no stop left.
 * `arrivedAt` is the session time the astronaut reached `at_stop` (tracked by the caller).
 */
export function sessionReplan(route: RouteResponse, state: WsState, arrivedAt: number | null): SessionReplan | null {
  const stops = routeStops(route)
  const pos: XY = [state.pos[0], state.pos[1]]
  const after = (stop: string) => stops.slice(stops.indexOf(stop) + 1).filter((s) => !state.visited.includes(s))
  if (state.at_stop && stops.includes(state.at_stop)) {
    const done = arrivedAt === null ? 0 : Math.max(0, state.t_min - arrivedAt)
    return { t_min: state.t_min, current_stop: state.at_stop, lead_min: 0, dwell_done_min: done, remaining: after(state.at_stop), storm_alert: !!state.alert, pos }
  }
  if (state.leg !== null) {
    const leg = route.legs[state.leg]
    if (!leg || !stops.includes(leg.to)) return null // walking home: nothing left to replan
    const path = leg.path.map((p) => [p[0], p[1]] as XY)
    return {
      t_min: state.t_min,
      current_stop: leg.to,
      lead_min: leadOnLeg(path, pos, leg.time_min),
      dwell_done_min: 0,
      remaining: after(leg.to),
      storm_alert: !!state.alert,
      pos,
    }
  }
  return null
}

/** When the astronaut reached the stop being dwelt at, per session and stop (`session|stop`). */
export type Arrival = { key: string; t: number }

/** The fields of the previous state the console saw, for telling a seen arrival from a jump. */
export type SeenState = Pick<WsState, 'session' | 't_min' | 'at_stop'>

/**
 * The arrival time behind `dwell_done_min` (MPC-3, Bunyamin's note). The state does not carry it,
 * so the console tracks it:
 * - Seen: the previous state of this session was not at this stop and the clock moved on by at most
 *   one second of sim time (`speed` minutes). The arrival is now.
 * - Not seen (page opened or reloaded during the dwell, or a seek into it): the route's planned
 *   dwell start, if the clock is inside that stop's planned dwell. After a storm detour the session
 *   clock runs ahead of the plan, so outside the window this falls back to now, i.e. no dwell done
 *   yet (the safe side: it only ever suggests shorter dwells).
 * Returns `current` itself when nothing changed, so a caller can keep it in state without a loop.
 */
export function trackArrival(
  current: Arrival | null,
  prev: SeenState | null,
  state: WsState,
  route: RouteResponse,
): Arrival | null {
  if (!state.at_stop) return null
  const key = `${state.session}|${state.at_stop}`
  const t = state.t_min
  if (current && current.key === key && t >= current.t) return current
  const step = Math.max(1, state.speed)
  const dwell = route.timeline.find((it) => it.kind === 'dwell' && it.stop === state.at_stop)
  const inWindow = dwell !== undefined && dwell.t0_min <= t && t <= dwell.t1_min
  const seen =
    prev !== null &&
    prev.session === state.session &&
    prev.at_stop !== state.at_stop &&
    t >= prev.t_min &&
    t - prev.t_min <= step
  if (seen) {
    // The first frame at the stop can come up to one step after the real arrival (2 states per
    // second at `speed` min/s); on plan, that step is the planned dwell start.
    return { key, t: inWindow && t - dwell.t0_min <= step ? dwell.t0_min : t }
  }
  if (inWindow) return { key, t: dwell.t0_min }
  return { key, t }
}

/** Re-check key (rule line 1): every replan_interval_min, on arrival at a stop, when a trigger changes. */
export function replanKey(s: SessionReplan | null, speed_factor: number, leak_min: number): string {
  if (!s) return 'none'
  const slot = Math.floor(s.t_min / REPLAN_INTERVAL_MIN)
  return [slot, s.current_stop, s.lead_min === 0 ? 'at' : 'walking', speed_factor, leak_min, !!s.storm_alert].join('|')
}

/** Stop names for the suggestion text. */
function names(aoi: Aoi, ids: string[]): string {
  return ids.map((id) => aoi.stops.find((s) => s.id === id)?.name ?? id).join(', ')
}

/** One line for the crew: what to change, from notebooks/replanning.py actions. */
export function suggestionText(r: ReplanResult, aoi: Aoi): string {
  switch (r.action) {
    case 'none':
      return r.reason === 'storm_alert' ? 'Storm alert: following the way home, no replan.' : 'Plan fits: no change.'
    case 'shorten_dwells':
      return `Shorten every remaining stop to ${r.dwell_min} min.`
    case 'drop_stops':
      return `Skip ${names(aoi, r.dropped)}${r.dwell_min < aoi.model.dwell_min ? `, stops ${r.dwell_min} min` : ''}.`
    case 'go_home_now':
      return 'Go home now.'
  }
}
