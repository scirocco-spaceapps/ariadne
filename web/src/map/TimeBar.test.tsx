import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fixtures } from '../lib/fixtures'
import type { WsState } from '../lib/types'
import { usePlanClock } from './planClock'
import { TimeBar } from './TimeBar'

const route = fixtures.route
const state = fixtures.frames.find((f): f is WsState => f.type === 'state' && f.t_min === 26)!

beforeEach(() => usePlanClock.getState().setT(0))
afterEach(cleanup)

describe('TimeBar', () => {
  it('moves the plan clock in planning mode', () => {
    render(<TimeBar route={route} state={null} provenance="Simulation" />)
    const bar = screen.getByRole('slider', { name: 'Plan time' }) as HTMLInputElement
    expect(bar.disabled).toBe(false)
    expect(bar.max).toBe(String(route.totals.eva_min))
    fireEvent.change(bar, { target: { value: '10' } })
    expect(usePlanClock.getState().t_min).toBe(10)
    expect(screen.getByTestId('time-bar-clock').textContent).toBe('T+ 0:10')
  })

  it('follows the session clock read-only', () => {
    render(<TimeBar route={route} state={state} provenance="Modeled" />)
    const bar = screen.getByRole('slider') as HTMLInputElement
    expect(bar.disabled).toBe(true)
    expect(bar.value).toBe('26')
    expect(screen.getByText('Simulation')).toBeTruthy()
    expect(screen.getByTestId('time-bar-clock').textContent).toBe('T+ 0:26')
  })

  it('marks each arrival with the stop number', () => {
    render(<TimeBar route={route} state={null} provenance="Simulation" />)
    const ticks = screen.getByRole('list', { name: 'Arrivals' }).querySelectorAll('li')
    expect(Array.from(ticks, (li) => li.textContent)).toEqual(['1', '2'])
  })

  it('shows the storm countdown only while an alert is active', () => {
    const at = (t: number) => fixtures.frames.find((f): f is WsState => f.type === 'state' && f.t_min === t)!
    const { rerender } = render(<TimeBar route={route} state={at(30)} provenance="Modeled" />)
    expect(screen.getByTestId('storm-chip').textContent).toBe('Storm in 25 min')
    rerender(<TimeBar route={route} state={at(38)} provenance="Modeled" />)
    expect(screen.getByTestId('storm-chip').textContent).toBe('Storm in 17 min')
    rerender(<TimeBar route={route} state={at(50)} provenance="Modeled" />)
    expect(screen.queryByTestId('storm-chip')).toBeNull()
  })
})
