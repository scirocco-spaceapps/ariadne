import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtures } from '../lib/fixtures'
import { App } from './App'
import { DEMO_TICK_MS, demoIndex } from './demo'
import { useMission } from './store'

beforeEach(() => {
  useMission.getState().reset()
  // Live mode asks mission-control for conditions; no service in tests.
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <App />
    </MemoryRouter>,
  )
}

describe('routes', () => {
  it('renders the console placeholder at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: /mission console/i })).toBeTruthy()
    expect(screen.queryByText('DEMO DATA')).toBeNull()
    expect(useMission.getState().aoi?.id).toBeTruthy()
  })

  it('renders the stop-card dev page at /dev/stops', () => {
    renderAt('/dev/stops')
    expect(screen.getByRole('heading', { name: /stop cards \(dev\)/i })).toBeTruthy()
  })

  it('renders the cuff at /cuff and asks for a session without ?s=', () => {
    renderAt('/cuff')
    expect(screen.getByRole('heading', { name: /no session/i })).toBeTruthy()
    expect(screen.getByTestId('cuff-status').textContent).toBe('No session')
  })
})

describe('DEMO mode', () => {
  it('shows the badge and advances the state from the fixture', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0) // the replay is locked to the wall clock
    renderAt('/cuff?demo=1')
    // One badge, in the cuff's header (no fixed overlay that would need extra top padding).
    expect(screen.getByText('DEMO DATA').closest('header')).toBeTruthy()
    expect(screen.getByTestId('cuff-status').textContent).toBe('DEMO replay')
    expect(screen.queryByTestId('link-banner')).toBeNull()
    const s = useMission.getState()
    expect(s.demo).toBe(true)
    expect(s.route).toEqual(fixtures.route)
    expect(s.session.state?.t_min).toBe(0)

    act(() => vi.advanceTimersByTime(DEMO_TICK_MS * 31))
    const st = useMission.getState().session
    expect(st.state?.t_min).toBe(31)
    expect(st.state?.alert?.type).toBe('storm_alert')
    expect(st.lastEvent?.name).toBe('storm_alert')
    expect(screen.getByTestId('cuff-clock').textContent).toBe('T+ 00:31:00')
  })
})

describe('DEMO clock lock', () => {
  it('puts two screens opened at different times on the same frame', () => {
    const n = 60
    // The index depends only on the wall clock: one tick later is the next frame, and it loops
    // after the fixture plus the pause.
    expect(demoIndex(0, n)).toBe(0)
    expect(demoIndex(DEMO_TICK_MS * 31 + 499, n)).toBe(31)
    expect(demoIndex(DEMO_TICK_MS * (n + 6), n)).toBe(0)
  })

  it('a second replay started later joins at the current frame', () => {
    vi.useFakeTimers()
    vi.setSystemTime(DEMO_TICK_MS * 12)
    renderAt('/?demo=1')
    expect(useMission.getState().session.state?.t_min).toBe(12)
  })
})

describe('store', () => {
  it('keeps state and events apart and resets the session on a new id', () => {
    const { receive, setSessionId } = useMission.getState()
    setSessionId('a')
    const state = fixtures.frames.find((f) => f.type === 'state')!
    receive(state)
    receive({ type: 'event', name: 'arrived', t_min: 4 })
    expect(useMission.getState().session.state).toBe(state)
    expect(useMission.getState().session.lastEvent?.name).toBe('arrived')
    setSessionId('b')
    expect(useMission.getState().session).toMatchObject({ id: 'b', state: null, lastEvent: null })
  })
})
