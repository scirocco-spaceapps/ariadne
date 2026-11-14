import { describe, expect, it } from 'vitest'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { WsState } from '../lib/types'
import type { XY } from './coords'
import {
  alongPath,
  arrivalTicks,
  dashes,
  evaClockLabel,
  nextProgress,
  pathLength,
  pointAt,
  progressAtTime,
  progressFromState,
  projectOnPath,
  routeGeometry,
  splitAt,
  stopIdFromPick,
  stopNumbers,
  type Progress,
} from './route'

const route = fixtures.route
const g = routeGeometry(route)
const states = fixtures.frames.filter((f): f is WsState => f.type === 'state')
const near = (a: XY | null, b: readonly number[], tol = 1) =>
  a !== null && Math.hypot(a[0] - b[0], a[1] - b[1]) <= tol
const len0 = g.legs[0].length
const len1 = g.legs[1].length

/** Replays the fixture stream like the map does and returns the progress after each state. */
function replay(frames: WsState[]): Progress[] {
  let prev: Progress | null = null
  return frames.map((s) => (prev = nextProgress(prev, g, s)))
}

describe('route geometry', () => {
  it('measures legs and cumulative starts from the fixture route', () => {
    expect(g.legs).toHaveLength(2)
    expect(len0).toBeCloseTo(200, 6)
    expect(g.legs[1].start).toBeCloseTo(len0, 6)
    expect(g.total).toBeCloseTo(400, 6)
  })

  it('walks and projects along a polyline', () => {
    const path: XY[] = [[0, 0], [10, 0], [10, 10]]
    expect(pathLength(path)).toBe(20)
    expect(alongPath(path, 15)).toEqual([10, 5])
    expect(alongPath(path, 99)).toEqual([10, 10])
    expect(projectOnPath(path, [12, 4])).toBeCloseTo(14, 6)
  })

  it('splits walked and ahead parts at a distance', () => {
    const { walked, ahead } = splitAt(g, len0 + 50)
    expect(walked).toHaveLength(2)
    expect(ahead).toHaveLength(1)
    expect(pathLength(walked[0]) + pathLength(walked[1])).toBeCloseTo(len0 + 50, 6)
    expect(pathLength(ahead[0])).toBeCloseTo(len1 - 50, 6)
    expect(splitAt(g, 0).walked).toHaveLength(0)
    expect(splitAt(g, g.total).ahead).toHaveLength(0)
  })

  it('cuts a path into dashes of the asked length', () => {
    const d = dashes([[0, 0], [100, 0]], 10, 5)
    expect(d).toHaveLength(7)
    expect(pathLength(d[0])).toBeCloseTo(10, 6)
    expect(d[1][0]).toEqual([15, 0])
    expect(pathLength(d[6])).toBeCloseTo(10, 6) // 90..100
    expect(dashes([[0, 0], [100, 0]], 0, 5)).toHaveLength(1)
  })
})

describe('planning mode (time bar)', () => {
  it('places the marker from the route timeline', () => {
    expect(progressAtTime(route, g, 0)).toBe(0)
    expect(progressAtTime(route, g, 2)).toBeCloseTo(len0 / 2, 6)
    expect(near(pointAt(g, progressAtTime(route, g, 10)), [220, 180])).toBe(true) // dwelling at s1
    expect(progressAtTime(route, g, 26)).toBeCloseTo(len0 + len1 / 2, 6)
    expect(progressAtTime(route, g, route.totals.eva_min)).toBeCloseTo(g.total, 6)
    expect(progressAtTime(route, g, 999)).toBeCloseTo(g.total, 6)
  })

  it('numbers stops in visiting order and ticks each arrival', () => {
    expect(stopNumbers(route)).toEqual({ s1: 1, s2: 2 })
    expect(arrivalTicks(route)).toEqual([
      { stop: 's1', n: 1, t_min: 4 },
      { stop: 's2', n: 2, t_min: 28 },
    ])
    expect(evaClockLabel(75.4)).toBe('T+ 1:15')
  })
})

describe('session mode (ws-state fixture replay)', () => {
  const progress = replay(states)
  const at = (t: number) => progress[states.findIndex((s) => s.t_min === t)]

  it('keeps the marker on the path while walking the plan', () => {
    states.forEach((s, i) => {
      if (s.leg === null) return
      expect(near(pointAt(g, progress[i].s), s.pos)).toBe(true)
    })
  })

  it('turns the walked part solid as the astronaut moves', () => {
    expect(at(0).s).toBe(0)
    expect(at(2).s).toBeCloseTo(len0 / 2, 6)
    expect(at(4).s).toBeCloseTo(len0, 6) // arrived at s1
    expect(at(26).s).toBeCloseTo(len0 + len1 / 2, 6)
    expect(at(28).s).toBeCloseTo(len0 + len1, 6) // dwelling at s2
    for (let i = 1; i < progress.length; i++) expect(progress[i].s).toBeGreaterThanOrEqual(progress[i - 1].s)
  })

  it('keeps both legs walked during the abort walk home', () => {
    const abort = states.find((s) => s.t_min === 33)!
    expect(abort.leg).toBeNull()
    expect(abort.abort_path).not.toBeNull()
    expect(progressFromState(g, abort)).toBeCloseTo(len0, 6) // the state alone only knows s1
    expect(at(33).s).toBeCloseTo(len0 + len1, 6) // the replay remembers s2 was reached
    expect(splitAt(g, at(33).s).ahead).toHaveLength(0)
  })

  it('starts again when the DEMO loop goes back to t = 0', () => {
    const looped = nextProgress(progress[progress.length - 1], g, states[0])
    expect(looped.s).toBe(0)
  })
})

describe('selecting a stop', () => {
  it('maps a click on a stop marker to its id and updates the store', () => {
    const layer = { id: 'places' } as never
    expect(stopIdFromPick({ layer, object: { id: 's2', haven: false } })).toBe('s2')
    expect(stopIdFromPick({ layer, object: { id: 'haven', haven: true } })).toBeNull()
    expect(stopIdFromPick({ layer: { id: 'track' } as never, object: { id: 's2' } })).toBeNull()
    expect(stopIdFromPick({ layer: null, object: undefined })).toBeNull()

    useMission.getState().reset()
    const id = stopIdFromPick({ layer, object: { id: 's1', haven: false } })
    if (id) useMission.getState().selectStop(id)
    expect(useMission.getState().selectedStop).toBe('s1')
  })
})
