import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMission } from '../app/store'
import { aoi, fixtures } from '../lib/fixtures'
import { PairCuff } from './PairCuff'
import { cuffUrl, isLocalHost } from './pairing'
import { SessionControls } from './SessionControls'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let search = ''
function SearchProbe() {
  const loc = useLocation()
  useEffect(() => {
    search = loc.search
  }, [loc.search])
  return null
}

function renderControls() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <SessionControls />
      <SearchProbe />
    </MemoryRouter>,
  )
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

describe('cuffUrl', () => {
  it('points the phone at the session or at the DEMO replay', () => {
    expect(cuffUrl('http://192.168.1.5:5173', 'a b', false)).toBe('http://192.168.1.5:5173/cuff?s=a%20b')
    expect(cuffUrl('https://ariadne.example/', null, true)).toBe('https://ariadne.example/cuff?demo=1')
    expect(cuffUrl('https://ariadne.example', null, false)).toBeNull()
  })

  it('knows which hosts a phone cannot reach', () => {
    expect(isLocalHost('localhost')).toBe(true)
    expect(isLocalHost('127.0.0.1')).toBe(true)
    expect(isLocalHost('192.168.1.5')).toBe(false)
  })
})

describe('SessionControls', () => {
  it('creates a session from the fixture route and puts the id in the store and URL', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, { id: 'sess-1' }))
    renderControls()
    expect(screen.getByText('Route: SYNTHETIC fixture')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Pair cuff' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    await waitFor(() => expect(useMission.getState().session.id).toBe('sess-1'))

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/sessions$/)
    expect(JSON.parse(String(init?.body))).toEqual({
      route: fixtures.route,
      budget_min: 240,
      reserve_min: 30,
      dwell_min: aoi.model.dwell_min,
    })
    await waitFor(() => expect(search).toBe('?s=sess-1'))
    expect((screen.getByRole('button', { name: 'Pair cuff' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows the service error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, { detail: 'route has no legs' }))
    renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))
    expect((await screen.findByRole('alert')).textContent).toBe('route has no legs')
    expect(useMission.getState().session.id).toBeNull()
  })

  it('starts a session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }))
    useMission.getState().setSessionId('sess-2')
    renderControls()
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toMatch(/\/sessions\/sess-2\/control$/)
    expect(JSON.parse(String(init?.body))).toEqual({ action: 'start' })
  })

  it('opens the pairing QR in DEMO mode without a service', () => {
    useMission.getState().setDemo(true)
    renderControls()
    expect(screen.queryByRole('button', { name: 'Create session' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pair cuff' }))
    expect(screen.getByTestId('qr-code').tagName.toLowerCase()).toBe('svg')
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
