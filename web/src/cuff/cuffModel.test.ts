import { describe, expect, it } from 'vitest'
import { fixtures } from '../lib/fixtures'
import type { WsState } from '../lib/types'
import { ENVELOPE_COLORS } from '../map'
import {
  ALERT_RED,
  budgetLeft,
  costAt,
  marginColour,
  minSec,
  nextTarget,
  routeStops,
  signedMin,
  walkDistance,
} from './cuffModel'

const states = fixtures.frames.filter((f) => f.type === 'state') as WsState[]
const at = (t: number) => states.find((s) => s.t_min === t)!
const route = fixtures.route

describe('nextTarget', () => {
  it('starts with the first stop', () => {
    const n = nextTarget(route, at(0))!
    expect(n).toMatchObject({ id: 's1', kind: 'stop', here: false, eta_min: 4 })
    expect(n.distance_m).toBeGreaterThan(150)
  })

  it('counts down distance and time along a leg', () => {
    const n = nextTarget(route, at(2))!
    expect(n.id).toBe('s1')
    expect(n.eta_min).toBe(2)
    expect(n.distance_m).toBeLessThan(nextTarget(route, at(0))!.distance_m)
  })

  it('is the stop itself while dwelling', () => {
    expect(nextTarget(route, at(10))).toMatchObject({ id: 's1', here: true, distance_m: 0 })
  })

  it('is the safe haven along the abort path during an alert', () => {
    const n = nextTarget(route, at(33))!
    expect(n).toMatchObject({ id: 'haven', kind: 'haven', eta_min: null, here: false })
    // From (260, 210) via (140, 120) to (60, 60): 150 + 100 m.
    expect(n.distance_m).toBeCloseTo(250, 0)
  })

  it('is home once back at the safe haven after an alert', () => {
    expect(nextTarget(route, at(59))).toBeNull()
  })

  it('needs a route and a state', () => {
    expect(nextTarget(null, at(2))).toBeNull()
    expect(nextTarget(route, null)).toBeNull()
  })
})

describe('numbers', () => {
  it('splits the budget against the reserve', () => {
    expect(budgetLeft(60, { budget_min: 240, reserve_min: 30 })).toEqual({
      left_min: 180,
      reserve_min: 30,
      frac: 0.75,
      reserveFrac: 0.125,
    })
    expect(budgetLeft(300, { budget_min: 240, reserve_min: 30 }).frac).toBe(0)
  })

  it('recovers the walk home from the margin', () => {
    // margin = 240 - 20 - 30 - cost → cost = 190 - margin
    expect(costAt(150, 20, { budget_min: 240, reserve_min: 30 })).toBe(40)
  })

  it('colours the margin like the map, with the alert red for out', () => {
    expect(marginColour('safe')).toBe(ENVELOPE_COLORS.safe)
    expect(marginColour('tight')).toBe(ENVELOPE_COLORS.tight)
    expect(marginColour('out')).toBe(ALERT_RED)
  })

  it('formats for the cuff', () => {
    expect(signedMin(142.4)).toBe('+142 min')
    expect(signedMin(-8)).toBe('−8 min')
    expect(minSec(22.5)).toBe('22:30')
    expect(walkDistance(420.4)).toBe('420 m')
    expect(walkDistance(1440)).toBe('1.4 km')
  })

  it('reads the stop order and the return flag from a route', () => {
    expect(routeStops(route)).toEqual({ stops: ['s1', 's2'], home: false })
    const back = { ...route, legs: [...route.legs, { ...route.legs[1], from: 's2', to: 'haven' }] }
    expect(routeStops(back)).toEqual({ stops: ['s1', 's2'], home: true })
  })
})
