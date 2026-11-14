import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { WsState } from '../lib/types'
import { Cuff } from './Cuff'
import { formatClock } from './format'

const firstState = fixtures.frames.find((f) => f.type === 'state') as WsState

beforeEach(() => useMission.getState().reset())
afterEach(cleanup)

describe('formatClock', () => {
  it('formats simulated minutes as a mission clock', () => {
    expect(formatClock(0)).toBe('T+ 00:00:00')
    expect(formatClock(31.5)).toBe('T+ 00:31:30')
    expect(formatClock(125.25)).toBe('T+ 02:05:15')
    expect(formatClock(-1)).toBe('T+ 00:00:00')
  })
})

describe('Cuff', () => {
  it('asks for the QR when there is no session', () => {
    render(<Cuff />)
    expect(screen.getByRole('heading', { name: /no session/i })).toBeTruthy()
    expect(screen.queryByTestId('cuff-clock')).toBeNull()
  })

  it('waits for the first state after joining', () => {
    const s = useMission.getState()
    s.setSessionId('abc')
    s.setSessionStatus('connecting')
    render(<Cuff />)
    expect(screen.getByTestId('cuff-status').textContent).toBe('Connecting')
    expect(screen.getByTestId('cuff-clock').textContent).toBe('T+ --:--:--')
  })

  it('shows the clock and the position with its Simulation provenance', () => {
    const s = useMission.getState()
    s.setSessionId(firstState.session)
    s.setSessionStatus('open')
    s.receive({ ...firstState, t_min: 31, running: true, pos: [163.2, 140.1] })
    render(<Cuff />)
    expect(screen.getByTestId('cuff-status').textContent).toBe('Connected')
    expect(screen.getByTestId('cuff-clock').textContent).toBe('T+ 00:31:00')
    expect(screen.getByText('Running')).toBeTruthy()
    const pos = screen.getByTestId('cuff-pos').textContent
    expect(pos).toContain('x 163 m · y 140 m')
    expect(pos).toContain('Simulation')
  })

  it('shows why the server rejected the session', () => {
    const s = useMission.getState()
    s.setSessionId('gone')
    s.setSessionStatus('rejected', 'unknown session')
    render(<Cuff />)
    expect(screen.getByTestId('cuff-status').textContent).toBe('Rejected: unknown session')
  })
})
