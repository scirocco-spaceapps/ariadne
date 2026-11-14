import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { WsState } from '../lib/types'
import { Cuff } from './Cuff'
import { formatClock } from './format'

// A flat cost-to-home map: 10 minutes home from anywhere in the fixture AOI (500 x 400 m, 2 m cells).
const COST = { data: new Float32Array(250 * 200).fill(10), cols: 250, rows: 200, px_m: 2, size_m: [500, 400] as [number, number] }
vi.mock('../map', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../map')>()),
  useCostToHome: () => COST,
}))

const states = fixtures.frames.filter((f) => f.type === 'state') as WsState[]
const at = (t: number) => states.find((s) => s.t_min === t)!

function renderCuff(url = '/cuff') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Cuff />
    </MemoryRouter>,
  )
}

/** DEMO-like store: fixture AOI, route and budget (240 / 30), one state. */
function demoAt(t: number) {
  const s = useMission.getState()
  s.setDemo(true)
  s.setAoi(fixtures.aoi)
  s.setRoute(fixtures.route)
  s.setBudget({ budget_min: 240, reserve_min: 30 })
  s.setSessionId('fx-session')
  s.setSessionStatus('open')
  s.receive(at(t))
}

beforeEach(() => useMission.getState().reset())
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('formatClock', () => {
  it('formats simulated minutes as a mission clock', () => {
    expect(formatClock(0)).toBe('T+ 00:00:00')
    expect(formatClock(31.5)).toBe('T+ 00:31:30')
    expect(formatClock(-1)).toBe('T+ 00:00:00')
  })
})

describe('Cuff', () => {
  it('asks for the QR when there is no session', () => {
    renderCuff()
    expect(screen.getByRole('heading', { name: /no session/i })).toBeTruthy()
  })

  it('shows margin, consumables and the next stop while walking', () => {
    demoAt(2)
    renderCuff()
    // margin = 240 - 2 - 30 - 10 = 198, safe (>= reserve 30); fixtures → Simulation.
    const margin = screen.getByTestId('cuff-margin').textContent!
    expect(margin).toContain('+198 min')
    expect(margin).toContain('Safe to continue')
    expect(margin).toContain('Simulation')
    expect(screen.getByTestId('cuff-budget').textContent).toContain('238 min left · reserve 30')
    const next = screen.getByTestId('cuff-next').textContent!
    expect(next).toContain('SYNTHETIC stop 1')
    expect(next).toContain('2 min')
    expect(screen.getByTestId('cuff-pos').textContent).toContain('Simulation')
    expect(screen.queryByTestId('cuff-alert')).toBeNull()
  })

  it('mounts the stop card while dwelling', () => {
    demoAt(10)
    renderCuff()
    expect(screen.getByTestId('cuff-next').textContent).toContain('At')
    expect(screen.getByTestId('stop-card')).toBeTruthy()
  })

  it('takes the whole screen for a storm alert', () => {
    demoAt(33)
    renderCuff()
    const alert = screen.getByTestId('cuff-alert')
    expect(alert.textContent).toContain('STORM ALERT')
    // lead 25 since t = 30, now 33 → 22:00 to the storm; walk home = cost 10 min.
    expect(screen.getByTestId('alert-storm').textContent).toContain('22:00')
    expect(screen.getByTestId('alert-return').textContent).toContain('10 min')
    expect(screen.getByTestId('alert-margin').textContent).toContain('+167 min')
    act(() => useMission.getState().receive(at(50)))
    expect(screen.queryByTestId('cuff-alert')).toBeNull()
  })

  it('plans the paired route from the link in live mode', async () => {
    const planned = { ...fixtures.route, provenance: 'Modeled' as const }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(planned), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    const s = useMission.getState()
    s.setAoi(fixtures.aoi)
    s.setSessionId('live-1')
    renderCuff('/cuff?s=live-1&stops=s2,s1&home=1')
    await waitFor(() => expect(useMission.getState().route).toEqual(planned))
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/route'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({ stops: ['s2', 's1'], return_home: true })
  })
})
