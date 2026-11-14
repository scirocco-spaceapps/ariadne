import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { fixtures } from '../lib/fixtures'
import type { RouteResponse, WsState } from '../lib/types'
import type { XY } from './coords'
import {
  combinations,
  decide,
  leadOnLeg,
  MIN_DWELL_MIN,
  REPLAN_CONTROLS,
  REPLAN_INTERVAL_MIN,
  replanKey,
  routeStops,
  sessionReplan,
  trackArrival,
  type Legs,
  type ReplanInput,
  type ReplanParams,
} from './replan'

// The test source is MPC-1's output, not the live planner (docs/notes/yusuf.md, MPC-1 note).
const repo = resolve(process.cwd(), '..')
const read = (p: string) => JSON.parse(readFileSync(resolve(repo, p), 'utf-8'))
type Case = { id: string; params: ReplanParams; input: ReplanInput & { x_m: number; y_m: number }; expected: Record<string, unknown> }
const casesFile = read('notebooks/out/replanning_cases.json') as {
  matching: { exact: string[]; tolerance_min: Record<string, number> }
  console: typeof REPLAN_CONTROLS
  legs_min: Legs
  cases: Case[]
}
const routeFile = read('notebooks/out/route.json') as { route: RouteResponse; legs_min: Legs }
const params = read('model/params.json') as Record<string, { value: number }>

describe('decide reproduces notebooks/out/replanning_cases.json', () => {
  const { exact, tolerance_min } = casesFile.matching

  it('has the cases and the matching rule MPC-1 promised', () => {
    expect(casesFile.cases.length).toBeGreaterThanOrEqual(11)
    expect(exact).toEqual(['action', 'reason', 'kept', 'dropped', 'dwell_min'])
    expect(routeFile.legs_min).toEqual(casesFile.legs_min)
  })

  for (const c of casesFile.cases) {
    it(c.id, () => {
      const got = decide(c.input, casesFile.legs_min, c.params) as unknown as Record<string, unknown>
      for (const k of exact) expect(got[k], k).toEqual(c.expected[k])
      for (const [k, tol] of Object.entries(tolerance_min)) {
        expect(Math.abs((got[k] as number) - (c.expected[k] as number)), k).toBeLessThanOrEqual(tol)
      }
    })
  }
})

describe('inputs and constants', () => {
  it('pins the constants to model/params.json and the cases file console block', () => {
    expect(REPLAN_INTERVAL_MIN).toBe(params.replan_interval_min.value)
    expect(MIN_DWELL_MIN).toBe(params.min_dwell_min.value)
    expect(REPLAN_CONTROLS).toEqual(casesFile.console && {
      speed_factor: casesFile.console.speed_factor,
      leak_min: casesFile.console.leak_min,
    })
  })

  it('reproduces lead_min mid-leg from the leg path (dust-0.5-mid-leg)', () => {
    const c = casesFile.cases.find((x) => x.id === 'dust-0.5-mid-leg')!
    const leg = routeFile.route.legs.find((l) => l.to === c.input.current_stop)!
    const lead = leadOnLeg(leg.path.map((p) => [p[0], p[1]] as XY), [c.input.x_m, c.input.y_m], leg.time_min)
    expect(Math.abs(lead - c.input.lead_min!)).toBeLessThanOrEqual(0.05)
  })

  it('enumerates subsets in itertools.combinations order', () => {
    expect(combinations(['a', 'b', 'c'], 2)).toEqual([
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'c'],
    ])
    expect(combinations(['a', 'b'], 0)).toEqual([[]])
  })
})

describe('sessionReplan (live state -> rule input)', () => {
  const route = fixtures.route
  const states = fixtures.frames.filter((f): f is WsState => f.type === 'state')
  const at = (t: number) => states.find((s) => s.t_min === t)!

  it('lists the plan stops without the haven', () => {
    expect(routeStops(route)).toEqual(['s1', 's2'])
  })

  it('walking: current stop is the leg end, lead from the leg path', () => {
    const r = sessionReplan(route, at(2), null)!
    expect(r.current_stop).toBe('s1')
    expect(r.lead_min).toBeCloseTo(2, 6) // half of the 4 min leg left
    expect(r.remaining).toEqual(['s2'])
  })

  it('dwelling: lead 0 and the dwell already spent from the arrival time', () => {
    const r = sessionReplan(route, at(10), 4)!
    expect(r).toMatchObject({ current_stop: 's1', lead_min: 0, dwell_done_min: 6, remaining: ['s2'] })
  })

  it('flags a storm alert and returns nothing after the plan (walking home or done)', () => {
    expect(sessionReplan(route, at(28), 28)!.storm_alert).toBe(false)
    expect(at(33).leg).toBeNull()
    expect(sessionReplan(route, at(33), null)).toBeNull() // abort walk: leg null, no stop
    const home = { ...at(2), leg: 1, at_stop: null } as WsState
    const toHaven: RouteResponse = { ...route, legs: [...route.legs, { ...route.legs[1], from: 's2', to: 'haven' }] }
    expect(sessionReplan(toHaven, { ...home, leg: 2 }, null)).toBeNull()
  })

  it('re-checks on the 5 min grid, on arrival and when a trigger changes', () => {
    const a = sessionReplan(route, at(2), null)
    const b = sessionReplan(route, at(3), null)
    expect(replanKey(a, 1, 0)).toBe(replanKey(b, 1, 0))
    expect(replanKey(a, 0.5, 0)).not.toBe(replanKey(a, 1, 0))
    expect(replanKey(sessionReplan(route, at(4), 4), 1, 0)).not.toBe(replanKey(b, 1, 0))
    expect(replanKey(null, 1, 0)).toBe('none')
  })
})

describe('trackArrival (MPC-3: arrival after a seek or a reload)', () => {
  const route = fixtures.route // s1 planned dwell 4-24 min
  const states = fixtures.frames.filter((f): f is WsState => f.type === 'state')
  const at = (t: number) => states.find((s) => s.t_min === t)!
  const seen = (s: WsState) => ({ session: s.session, t_min: s.t_min, at_stop: s.at_stop })
  const key = `${at(4).session}|s1`

  it('a seen arrival is now (previous frame was walking, clock moved on by one step)', () => {
    expect(trackArrival(null, seen(at(3)), at(4), route)).toEqual({ key, t: 4 })
  })

  it('keeps the arrival through the dwell and returns the same object', () => {
    const a = { key, t: 4 }
    expect(trackArrival(a, seen(at(4)), at(5), route)).toBe(a)
    expect(trackArrival(a, seen(at(5)), at(10), route)).toBe(a)
  })

  it('a reload during the dwell takes the planned dwell start', () => {
    expect(trackArrival(null, null, at(10), route)).toEqual({ key, t: 4 })
  })

  it('a seek into the dwell takes the planned dwell start, not the seek time', () => {
    expect(trackArrival(null, seen(at(3)), { ...at(10), speed: 1 }, route)).toEqual({ key, t: 4 })
  })

  it('a seek back inside the same dwell is re-estimated from the plan', () => {
    expect(trackArrival({ key, t: 10 }, seen(at(10)), at(5), route)).toEqual({ key, t: 4 })
  })

  it('outside the planned window (session clock ahead after a storm detour) counts no dwell done', () => {
    const late = { ...at(10), t_min: 30 } // at s1 at t 30, past its planned 4-24 window
    expect(trackArrival(null, null, late, route)).toEqual({ key, t: 30 })
    expect(sessionReplan(route, late, 30)!.dwell_done_min).toBe(0)
  })

  it('a seen arrival after a detour is still now, not the earlier plan time', () => {
    const prev = { session: at(4).session, t_min: 37.5, at_stop: null }
    const arrive = { ...at(10), t_min: 38 }
    expect(trackArrival(null, prev, arrive, route)).toEqual({ key, t: 38 })
  })

  it('no stop, no arrival', () => {
    expect(trackArrival({ key, t: 4 }, seen(at(10)), at(30), route)).toBeNull()
  })
})
