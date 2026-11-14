// MPC-2 wiring: the leg table from the planner, the what-if controls, the live rule input and the
// suggested path. The rule itself is pure (replan.ts); this file only fetches and remembers.

import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { useMission } from '../app/store'
import { planner } from '../lib/api'
import type { RouteResponse } from '../lib/types'
import type { AssetSource } from './assets'
import type { XY } from './coords'
import { costToHomeAt, useCostToHome } from './envelope'
import { projectOnPath, alongPath, pathLength } from './route'
import {
  decide,
  HAVEN,
  MIN_DWELL_MIN,
  REPLAN_CONTROLS,
  replanKey,
  routeStops,
  sessionReplan,
  type Legs,
  type ReplanResult,
  type SessionReplan,
} from './replan'

// ------------------------------------------------------------------ what-if controls

type Controls = {
  leakOn: boolean
  leak_min: number
  dustOn: boolean
  speed_factor: number
  set: (patch: Partial<Omit<Controls, 'set'>>) => void
}

/** The console's two what-if triggers (Simulation). Off = no trigger (leak 0, speed x1). */
export const useReplanControls = create<Controls>((set) => ({
  leakOn: false,
  leak_min: REPLAN_CONTROLS.leak_min.default,
  dustOn: false,
  speed_factor: REPLAN_CONTROLS.speed_factor.default,
  set: (patch) => set(patch),
}))

// ------------------------------------------------------------------ leg table

/**
 * Leg times for every pair of stops in plan order and every stop -> haven, from the existing
 * POST /route: [a, b] gives haven->a, a->b, b->haven and [a] gives haven->a, a->haven. The leg from
 * the haven is ignored, because /route always starts there and the astronaut is already out.
 */
export function legTableFromResponses(pairs: { stops: string[]; route: RouteResponse }[]): Legs {
  const legs: Legs = {}
  for (const { route } of pairs) {
    for (const leg of route.legs) {
      if (leg.from === HAVEN) continue
      ;(legs[leg.from] ??= {})[leg.to] = leg.time_min
    }
  }
  return legs
}

/** The [a, b] (i < j) and [a] requests that fill the table for a plan's stops. */
export function legRequests(stops: string[]): string[][] {
  const out: string[][] = []
  stops.forEach((a, i) => {
    out.push([a])
    for (const b of stops.slice(i + 1)) out.push([a, b])
  })
  return out
}

export type LegTable = { status: 'off' | 'loading' | 'ready' | 'error'; legs: Legs | null }

function useLegTable(route: RouteResponse | null, enabled: boolean): LegTable {
  const key = route && enabled ? routeStops(route).join(',') : ''
  const [table, setTable] = useState<{ key: string; t: LegTable }>({ key: '', t: { status: 'off', legs: null } })
  useEffect(() => {
    if (!key) return
    const ctl = new AbortController()
    const stops = key.split(',')
    Promise.all(
      legRequests(stops).map((s) =>
        planner.route({ stops: s, return_home: true }, ctl.signal).then((route) => ({ stops: s, route })),
      ),
    )
      .then((rs) => setTable({ key, t: { status: 'ready', legs: legTableFromResponses(rs) } }))
      .catch(() => {
        if (!ctl.signal.aborted) setTable({ key, t: { status: 'error', legs: null } })
      })
    return () => ctl.abort()
  }, [key])
  return key && table.key === key ? table.t : { status: key ? 'loading' : 'off', legs: null }
}

// ------------------------------------------------------------------ the suggestion

export type Replan = {
  /** False in DEMO, without a route or before a session state. */
  active: boolean
  /** A storm alert is active: no suggestion (rule line 9), mission-control's abort sends the astronaut home. */
  storm: boolean
  table: LegTable['status']
  input: SessionReplan | null
  result: ReplanResult | null
  /** Suggested way for drop_stops (planner route) or go_home_now (planner abort), AOI metres. */
  path: XY[][] | null
  reserve_min: number
}

/** The rest of the current leg from the astronaut's position. */
function legRemainder(path: XY[], pos: XY): XY[] {
  const s = projectOnPath(path, pos)
  const total = pathLength(path)
  if (s >= total) return []
  const out: XY[] = [pos]
  let walked = 0
  for (let i = 1; i < path.length; i++) {
    walked += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
    if (walked > s) out.push(path[i])
  }
  return out.length >= 2 ? out : [pos, alongPath(path, total)]
}

export function useReplan(source: AssetSource): Replan {
  const demo = useMission((s) => s.demo)
  const route = useMission((s) => s.route)
  const state = useMission((s) => s.session.state)
  const aoi = source.aoi
  const { leakOn, leak_min, dustOn, speed_factor } = useReplanControls()
  const enabled = !demo && route !== null
  const table = useLegTable(route, enabled)
  const cost = useCostToHome(source)

  // Arrival time at the stop being dwelt at, remembered per session (the state does not carry it).
  const [arrival, setArrival] = useState<{ key: string; t: number } | null>(null)
  const stopKey = state?.at_stop ? `${state.session}|${state.at_stop}` : null
  if (stopKey && arrival?.key !== stopKey) setArrival({ key: stopKey, t: state!.t_min })
  const arrivedAt = stopKey && arrival?.key === stopKey ? arrival.t : null

  const input = enabled && state && route ? sessionReplan(route, state, arrivedAt) : null
  const leak = leakOn ? leak_min : 0
  const speed = dustOn ? speed_factor : 1
  const key = `${replanKey(input, speed, leak)}|${table.status}`

  // Re-check only when the rule says so (5 min grid, arrival, trigger change).
  const [decision, setDecision] = useState<{ key: string; result: ReplanResult | null }>({ key: '', result: null })
  if (decision.key !== key) {
    let result: ReplanResult | null = null
    if (input && table.legs) {
      const home = cost ? costToHomeAt(cost, input.pos[0], input.pos[1]) : null
      const legs = table.legs
      const fallback = (input.lead_min ?? 0) + (legs[input.current_stop]?.[HAVEN] ?? 0)
      result = decide(
        { ...input, home_now_min: home ?? fallback, speed_factor: speed, leak_min: leak },
        legs,
        { budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min, dwell_min: aoi.model.dwell_min, min_dwell_min: MIN_DWELL_MIN },
      )
    }
    setDecision({ key, result })
  }
  const result = decision.key === key ? decision.result : null

  // The suggested way: one /route call for dropped stops, /abort for going home now.
  const pathKey =
    result && input && (result.action === 'drop_stops' || result.action === 'go_home_now')
      ? `${key}|${result.action}|${result.kept.join(',')}`
      : ''
  const [path, setPath] = useState<{ key: string; path: XY[][] | null }>({ key: '', path: null })
  const currentLeg = useMemo(() => {
    if (!route || !input || (input.lead_min ?? 0) === 0) return null
    const leg = route.legs.find((l) => l.to === input.current_stop)
    return leg ? leg.path.map((p) => [p[0], p[1]] as XY) : null
  }, [route, input?.current_stop, input?.lead_min]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pathKey || !result || !input) return
    const ctl = new AbortController()
    const pos = input.pos
    const job =
      result.action === 'go_home_now'
        ? planner.abort({ from: pos }, ctl.signal).then((r) => [r.path.map((p) => [p[0], p[1]] as XY)])
        : planner.route({ stops: [input.current_stop, ...result.kept], return_home: true }, ctl.signal).then((r) => {
            const legs = r.legs.slice(1).map((l) => l.path.map((p) => [p[0], p[1]] as XY))
            return currentLeg ? [legRemainder(currentLeg, pos), ...legs] : legs
          })
    job.then(
      (p) => setPath({ key: pathKey, path: p }),
      () => !ctl.signal.aborted && setPath({ key: pathKey, path: null }),
    )
    return () => ctl.abort()
  }, [pathKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    active: enabled && state !== null,
    storm: !!state?.alert,
    table: table.status,
    input,
    result,
    path: pathKey && path.key === pathKey ? path.path : null,
    reserve_min: aoi.model.reserve_min,
  }
}
