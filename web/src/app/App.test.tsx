import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtures } from '../lib/fixtures'
import { App } from './App'
import { DEMO_TICK_MS } from './demo'
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

  it('renders the cuff placeholder at /cuff', () => {
    renderAt('/cuff')
    expect(screen.getByRole('heading', { name: /cuff/i })).toBeTruthy()
  })
})

describe('DEMO mode', () => {
  it('shows the badge and advances the state from the fixture', () => {
    vi.useFakeTimers()
    renderAt('/cuff?demo=1')
    expect(screen.getByText('DEMO DATA')).toBeTruthy()
    const s = useMission.getState()
    expect(s.demo).toBe(true)
    expect(s.route).toEqual(fixtures.route)
    expect(s.session.state?.t_min).toBe(0)

    act(() => vi.advanceTimersByTime(DEMO_TICK_MS * 31))
    const st = useMission.getState().session
    expect(st.state?.t_min).toBe(31)
    expect(st.state?.alert?.type).toBe('storm_alert')
    expect(st.lastEvent?.name).toBe('storm_alert')
    expect(screen.getByTestId('session-line').textContent).toContain('T+31.0')
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
