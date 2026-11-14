import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { aoi } from '../lib/fixtures'
import type { RouteResponse } from '../lib/types'
import { suggestionText, type ReplanResult } from './replan'
import { ReplanPanel } from './ReplanPanel'
import { legRequests, legTableFromResponses, useReplanControls, type Replan } from './useReplan'

const result = (over: Partial<ReplanResult>): ReplanResult => ({
  action: 'none',
  reason: 'plan_fits',
  deadline_min: 300,
  kept: [],
  dropped: [],
  dwell_min: 20,
  end_min: 219.65,
  margin_min: 80.35,
  reserve_left_min: 140.35,
  ...over,
})
const replan = (over: Partial<Replan>): Replan => ({
  active: true,
  storm: false,
  table: 'ready',
  input: null,
  result: result({}),
  path: null,
  reserve_min: 60,
  ...over,
})

beforeEach(() => useReplanControls.setState({ leakOn: false, leak_min: 120, dustOn: false, speed_factor: 0.5 }))
afterEach(cleanup)

describe('ReplanPanel', () => {
  it('is hidden without a live session (DEMO, no route, no state)', () => {
    render(<ReplanPanel replan={replan({ active: false })} aoi={aoi} />)
    expect(screen.queryByTestId('replan-panel')).toBeNull()
  })

  it('shows the suggestion and the reserve on arrival', () => {
    render(<ReplanPanel replan={replan({})} aoi={aoi} />)
    expect(screen.getByTestId('replan-suggestion').textContent).toContain('Plan fits: no change.')
    expect(screen.getByTestId('replan-suggestion').textContent).toContain('Home with 140 min reserve')
  })

  it('turns the what-if triggers on through the store', () => {
    render(<ReplanPanel replan={replan({})} aoi={aoi} />)
    const leak = screen.getByRole('slider', { name: /Suit leak/ }) as HTMLInputElement
    expect(leak.disabled).toBe(true)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(useReplanControls.getState().leakOn).toBe(true)
    fireEvent.change(screen.getByRole('slider', { name: /Suit leak/ }), { target: { value: '150' } })
    expect(useReplanControls.getState().leak_min).toBe(150)
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.change(screen.getByRole('slider', { name: /Dust/ }), { target: { value: '0.4' } })
    expect(useReplanControls.getState()).toMatchObject({ dustOn: true, speed_factor: 0.4 })
  })

  it('shows no suggestion during a storm alert, also on the walk home (rule line 9)', () => {
    render(<ReplanPanel replan={replan({ storm: true, input: null, result: null })} aoi={aoi} />)
    const text = screen.getByTestId('replan-suggestion').textContent
    expect(text).toContain('Storm alert: following the way home, no replan.')
    expect(text).not.toContain('Nothing to replan')
  })

  it('tells when the planner did not give leg times', () => {
    render(<ReplanPanel replan={replan({ table: 'error', result: null })} aoi={aoi} />)
    expect(screen.getByTestId('replan-suggestion').textContent).toContain('Replanning unavailable')
  })
})

describe('suggestion text', () => {
  it('names the action for the crew', () => {
    expect(suggestionText(result({ action: 'shorten_dwells', reason: null, dwell_min: 16 }), aoi)).toBe(
      'Shorten every remaining stop to 16 min.',
    )
    expect(suggestionText(result({ action: 'drop_stops', reason: null, dropped: ['masonic-temple'] }), aoi)).toBe(
      'Skip Masonic Temple.',
    )
    expect(suggestionText(result({ action: 'go_home_now', reason: null }), aoi)).toBe('Go home now.')
    expect(suggestionText(result({ reason: 'storm_alert' }), aoi)).toContain('Storm alert')
  })
})

describe('leg table from POST /route', () => {
  it('asks [a] and every [a, b] in plan order', () => {
    expect(legRequests(['a', 'b', 'c'])).toEqual([['a'], ['a', 'b'], ['a', 'c'], ['b'], ['b', 'c'], ['c']])
  })

  it('keeps stop -> stop and stop -> haven legs and ignores the leg from the haven', () => {
    const leg = (from: string, to: string, time_min: number) => ({ from, to, time_min, path: [], distance_m: 0, climb_m: 0, max_slope_deg: 0 })
    const r = (legs: ReturnType<typeof leg>[]) => ({ legs, timeline: [], totals: { distance_m: 0, walk_min: 0, dwell_min: 0, eva_min: 0 }, provenance: 'Modeled' }) as unknown as RouteResponse
    const legs = legTableFromResponses([
      { stops: ['a'], route: r([leg('haven', 'a', 9), leg('a', 'haven', 8)]) },
      { stops: ['a', 'b'], route: r([leg('haven', 'a', 9), leg('a', 'b', 3), leg('b', 'haven', 7)]) },
    ])
    expect(legs).toEqual({ a: { haven: 8, b: 3 }, b: { haven: 7 } })
  })
})
