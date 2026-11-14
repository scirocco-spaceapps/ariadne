import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMission } from '../app/store'
import { aoi, fixtures } from '../lib/fixtures'
import type { WsState } from '../lib/types'
import { PairCuff } from './PairCuff'
import { cuffUrl, isLocalHost } from './pairing'
import { evaClock, minSec, shortcutFor, timeToStorm } from './session'
import { SessionBar } from './SessionBar'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const baseState = fixtures.frames.find((f) => f.type === 'state') as WsState

let search = ''
function SearchProbe() {
  const loc = useLocation()
  useEffect(() => {
    search = loc.search
  }, [loc.search])
  return null
}

function renderBar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionBar />
      <SearchProbe />
    </MemoryRouter>,
  )
}

/** A live session with one state frame in the store. */
function liveSession(state: Partial<WsState> = {}) {
  const s = useMission.getState()
  s.setSessionId('sess-1')
  s.setSessionStatus('open')
  s.receive({ ...baseState, session: 'sess-1', ...state })
}

/** The JSON bodies of every fetch call whose URL ends with `suffix`. */
function bodies(fetchMock: ReturnType<typeof vi.spyOn>, suffix: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([u]: unknown[]) => String(u).endsWith(suffix))
    .map(([, init]: unknown[]) => JSON.parse(String((init as RequestInit).body)))
}

beforeEach(() => {
  useMission.getState().reset()
  useMission.getState().setBudget({ budget_min: 240, reserve_min: 30 })
  search = ''
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('session helpers', () => {
  it('computes time to storm from the alert', () => {
    expect(timeToStorm(null)).toBeNull()
    expect(timeToStorm({ ...baseState, alert: null })).toBeNull()
    const s = { ...baseState, t_min: 33, alert: { type: 'storm_alert' as const, lead_min: 25, since_t: 30 } }
    expect(timeToStorm(s)).toBe(22)
    expect(timeToStorm({ ...s, t_min: 80 })).toBe(0)
    expect(minSec(22.5)).toBe('22:30')
    expect(evaClock(125.9)).toBe('T+ 2:05')
  })

  it('maps S, A and C, but not while typing or with a modifier', () => {
    const key = (k: string, extra: Partial<KeyboardEvent> = {}) =>
      shortcutFor({ key: k, ctrlKey: false, metaKey: false, altKey: false, target: document.body, ...extra })
    expect(key('s')).toBe('start')
    expect(key('A')).toBe('alert')
    expect(key('c')).toBe('clear')
    expect(key('x')).toBeNull()
    expect(key('s', { ctrlKey: true })).toBeNull()
    expect(key('a', { target: document.createElement('input') })).toBeNull()
  })

  it('points the phone at the session or at the DEMO replay', () => {
    expect(cuffUrl('http://192.168.1.5:5173', 'a b', false)).toBe('http://192.168.1.5:5173/cuff?s=a%20b')
    expect(cuffUrl('https://ariadne.example/', null, true)).toBe('https://ariadne.example/cuff?demo=1')
    expect(cuffUrl('https://ariadne.example', null, false)).toBeNull()
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('192.168.1.5')).toBe(false)
  })
})

describe('SessionBar', () => {
  it('plans the route when there is none, then creates the session and puts the id in the URL', async () => {
    useMission.getState().setAoi(aoi)
    const planned = { ...fixtures.route, provenance: 'Modeled' as const }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/route') ? jsonResponse(200, planned) : jsonResponse(201, { id: 'sess-9' }),
    )
    renderBar()
    expect((screen.getByRole('button', { name: /Start/ }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    await waitFor(() => expect(useMission.getState().session.id).toBe('sess-9'))
    expect(bodies(fetchMock, '/route')).toEqual([{ stops: aoi.stops.map((st) => st.id), return_home: true }])
    expect(useMission.getState().route).toEqual(planned)
    expect(bodies(fetchMock, '/sessions')).toEqual([
      { route: planned, budget_min: 240, reserve_min: 30, dwell_min: aoi.model.dwell_min },
    ])
    await waitFor(() => expect(search).toBe('?s=sess-9'))
  })

  it('uses an already planned route without asking the planner again', async () => {
    const planned = { ...fixtures.route, provenance: 'Modeled' as const }
    useMission.getState().setRoute(planned)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { id: 'sess-8' }))
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    await waitFor(() => expect(useMission.getState().session.id).toBe('sess-8'))
    expect(bodies(fetchMock, '/route')).toEqual([])
  })

  it('refuses to start a live session on the SYNTHETIC fixture route', async () => {
    useMission.getState().setRoute(fixtures.route)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { id: 'x' }))
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Plan the route first')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows why when the planner cannot plan', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(422, { detail: 'stop tuff-cliff is unreachable' }))
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Could not plan a route: stop tuff-cliff is unreachable.')
    expect(useMission.getState().session.id).toBeNull()
  })

  it('shows the service error on a failed create', async () => {
    useMission.getState().setRoute({ ...fixtures.route, provenance: 'Modeled' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, { detail: 'route has no legs' }))
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    expect((await screen.findByRole('alert')).textContent).toBe('route has no legs')
  })

  it('starts with the chosen speed, re-sends start on a speed change, pauses and resets', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }))
    liveSession({ running: false })
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    await waitFor(() => expect(bodies(fetchMock, '/control')).toEqual([{ action: 'start', speed: 6 }]))

    act(() => useMission.getState().receive({ ...baseState, session: 'sess-1', running: true }))
    fireEvent.change(screen.getByRole('combobox', { name: /Speed/ }), { target: { value: '12' } })
    await waitFor(() => expect(bodies(fetchMock, '/control')).toHaveLength(2))
    expect(bodies(fetchMock, '/control')[1]).toEqual({ action: 'start', speed: 12 })

    fireEvent.click(screen.getByRole('button', { name: /Pause/ }))
    await waitFor(() => expect(bodies(fetchMock, '/control')).toHaveLength(3))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(bodies(fetchMock, '/control')).toHaveLength(4))
    expect(bodies(fetchMock, '/control').slice(2)).toEqual([{ action: 'pause' }, { action: 'reset' }])
  })

  it('seeks when the scrubber is released', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }))
    liveSession()
    renderBar()
    const range = screen.getByRole('slider', { name: /seek/ })
    fireEvent.change(range, { target: { value: '20' } })
    fireEvent.pointerUp(range)
    await waitFor(() => expect(bodies(fetchMock, '/control')).toEqual([{ action: 'seek', t_min: 20 }]))
  })

  it('sends the storm alert and clear, also from the keyboard', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }))
    liveSession()
    renderBar()

    fireEvent.click(screen.getByRole('button', { name: /Storm alert/ }))
    await waitFor(() => expect(bodies(fetchMock, '/events')).toEqual([{ type: 'storm_alert', lead_min: 30 }]))

    // The alert arrives: the strip counts down and Clear becomes available.
    act(() =>
      useMission
        .getState()
        .receive({ ...baseState, session: 'sess-1', t_min: 33, alert: { type: 'storm_alert', lead_min: 30, since_t: 30 } }),
    )
    expect(screen.getByTestId('storm-strip').textContent).toContain('time to storm 27:00')

    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(bodies(fetchMock, '/events')).toHaveLength(2))
    expect(bodies(fetchMock, '/events')[1]).toEqual({ type: 'clear' })

    // Shortcuts wait until the previous request has finished.
    await waitFor(() => expect((screen.getByRole('button', { name: /Start|Pause/ }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.keyDown(window, { key: 's' })
    await waitFor(() => expect(bodies(fetchMock, '/control')).toHaveLength(1))
  })

  it('disables the service controls in DEMO mode but still pairs the cuff', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }))
    const s = useMission.getState()
    s.setDemo(true)
    s.setSessionId('fx-session')
    s.receive(baseState)
    renderBar()
    for (const name of [/Create session/, /Start|Pause/, /Storm alert/, /^Reset$/]) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    }
    fireEvent.keyDown(window, { key: 'a' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/DEMO replay/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pair cuff' }))
    expect(screen.getByTestId('pair-url').textContent).toMatch(/\/cuff\?demo=1$/)
  })
})

describe('PairCuff', () => {
  it('warns when the console runs on localhost', () => {
    render(<PairCuff url="http://localhost:5173/cuff?s=x" demo={false} onClose={() => {}} hostname="localhost" />)
    expect(screen.getByRole('alert').textContent).toContain('npm run dev:lan')
  })

  it('does not warn on a LAN address and closes on Escape', () => {
    const onClose = vi.fn()
    render(<PairCuff url="http://192.168.1.5:5173/cuff?s=x" demo={false} onClose={onClose} hostname="192.168.1.5" />)
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
