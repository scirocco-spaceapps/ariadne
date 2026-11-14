import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { Conditions } from '../lib/types'
import { ConditionsPanel } from './ConditionsPanel'
import { formatNumber, formatUnit, formatUtc, partState, valueLabel } from './conditions'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

beforeEach(() => useMission.getState().reset())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('helpers', () => {
  it('formats values, units and times', () => {
    expect(formatNumber(null)).toBe('—')
    expect(formatNumber(-80)).toBe('-80')
    expect(formatNumber(0.1234)).toBe('0.12')
    expect(formatUnit('degC')).toBe('°C')
    expect(formatUnit('Pa')).toBe('Pa')
    expect(formatUtc('2026-11-14T10:30:00Z')).toBe('2026-11-14 10:30 UTC')
    expect(valueLabel('air_temp_min')).toBe('Air temp min')
    expect(valueLabel('wind')).toBe('wind')
  })

  it('reports missing parts with the service reason', () => {
    expect(partState(fixtures.conditions, 'weather')).toEqual({ present: true })
    expect(partState(fixtures.conditions, 'radiation')).toEqual({
      present: false,
      reason: fixtures.conditions.missing.radiation,
    })
  })
})

describe('ConditionsPanel', () => {
  it('renders the DEMO fixture with badges, reasons and the partner slot', () => {
    const s = useMission.getState()
    s.setDemo(true)
    s.setConditions(fixtures.conditions)
    render(<ConditionsPanel />)

    const weather = screen.getByTestId('cond-weather')
    expect(within(weather).getByText('Air temp min')).toBeTruthy()
    expect(within(weather).getByText('-80 °C')).toBeTruthy()
    expect(within(weather).getByText('ARCHIVE')).toBeTruthy()
    expect(within(weather).getByText('Simulation')).toBeTruthy()

    const radiation = screen.getByTestId('cond-radiation')
    expect(radiation.textContent).toContain('Not available.')
    expect(radiation.textContent).toContain(fixtures.conditions.missing.radiation!)

    expect(within(screen.getByTestId('cond-space_weather')).getByText('LIVE')).toBeTruthy()
    expect(screen.getByTestId('cond-partner').textContent).toContain('SYNTHETIC agency')
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull()
  })

  it('loads live conditions, hides an absent partner and shows a stale notice', async () => {
    const live: Conditions = {
      ...fixtures.conditions,
      partner: null,
      space_weather: { ...fixtures.conditions.space_weather!, stale: true },
      missing: { ...fixtures.conditions.missing, partner: 'no partner value' },
    }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, live))
    render(<ConditionsPanel />)
    await waitFor(() => expect(screen.getByText(/Stale/)).toBeTruthy())
    expect(screen.queryByTestId('cond-partner')).toBeNull()
    expect(useMission.getState().conditions).toEqual(live)
  })

  it('shows the error and keeps every card when the service is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    render(<ConditionsPanel />)
    expect((await screen.findByRole('alert')).textContent).toContain('mission-control is unreachable')
    expect(screen.getByTestId('cond-weather').textContent).toContain('No data.')
    expect(screen.getByTestId('cond-space_weather')).toBeTruthy()
  })
})
