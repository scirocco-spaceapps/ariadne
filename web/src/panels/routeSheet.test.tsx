import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMission } from '../app/store'
import { fixtures } from '../lib/fixtures'
import type { RouteResponse } from '../lib/types'
import { demFromBuffer, elevationSeries, sampleDem, type Dem } from './elevation'
import { evaClock, legRows, placeName } from './route'
import { RouteSheet } from './RouteSheet'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** A fixture-sized DEM whose elevation rises 1 m per metre east (z = x). */
function rampDem(): Dem {
  const aoi = fixtures.aoi
  const px = aoi.rasters.dem.px_m
  const cols = aoi.size_m[0] / px
  const rows = aoi.size_m[1] / px
  const data = new Float32Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) data[r * cols + c] = (c + 0.5) * px
  return { data, size_m: aoi.size_m, px_m: px }
}

beforeEach(() => {
  useMission.getState().reset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('legRows', () => {
  it('times each arrival from the timeline and counts the budget down', () => {
    const rows = legRows(fixtures.route, { budget_min: 240, reserve_min: 30 })
    expect(rows.map((r) => [r.from, r.to, r.arrive_t, r.depart_t, r.budget_left])).toEqual([
      ['haven', 's1', 4, 24, 236],
      ['s1', 's2', 28, 48, 212],
    ])
    expect(rows.some((r) => r.belowReserve)).toBe(false)
  })

  it('flags an arrival below the reserve', () => {
    const rows = legRows(fixtures.route, { budget_min: 50, reserve_min: 30 })
    expect(rows.map((r) => r.belowReserve)).toEqual([false, true])
  })

  it('formats the EVA clock and names places', () => {
    expect(evaClock(0)).toBe('T+ 0:00')
    expect(evaClock(125)).toBe('T+ 2:05')
    expect(placeName(fixtures.aoi, 'haven')).toBe(fixtures.aoi.safe_haven.name)
    expect(placeName(fixtures.aoi, 'nope')).toBe('nope')
  })
})

describe('elevation', () => {
  it('samples the DEM along the legs and holds it while dwelling', () => {
    const series = elevationSeries(fixtures.route, rampDem())
    expect(series[0].t).toBe(0)
    expect(series[series.length - 1].t).toBe(48)
    // Times never go backwards.
    for (let i = 1; i < series.length; i++) expect(series[i].t).toBeGreaterThanOrEqual(series[i - 1].t)
    // Leg 0 starts at the haven (x = 60) on a z = x ramp.
    expect(Math.abs(series[0].z - 60)).toBeLessThanOrEqual(4)
  })

  it('skips NaN cells and points outside the AOI', () => {
    const dem = rampDem()
    dem.data.fill(Number.NaN)
    expect(sampleDem(dem, [10, 10])).toBeNull()
    expect(sampleDem(rampDem(), [-5, 10])).toBeNull()
    expect(elevationSeries(fixtures.route, dem)).toEqual([])
  })

  it('rejects a DEM of the wrong size', () => {
    expect(demFromBuffer(new ArrayBuffer(16), fixtures.aoi)).toBeNull()
    const ok = rampDem()
    expect(demFromBuffer(ok.data.buffer as ArrayBuffer, fixtures.aoi)).not.toBeNull()
  })
})

describe('RouteSheet', () => {
  function liveSetup() {
    const s = useMission.getState()
    s.setAoi(fixtures.aoi)
    s.setBudget({ budget_min: 240, reserve_min: 30 })
  }

  it('posts the chosen order and stores the planner route', async () => {
    liveSetup()
    const planned: RouteResponse = { ...fixtures.route, provenance: 'Modeled' }
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/route') ? jsonResponse(200, planned) : new Response(null, { status: 404 }),
    )
    render(<RouteSheet />)
    // Move s2 up: order becomes s2, s1.
    fireEvent.click(screen.getByRole('button', { name: 'Move s2 up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Plan route' }))
    await waitFor(() => expect(useMission.getState().route).toEqual(planned))
    const call = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/route'))!
    expect(JSON.parse(String(call[1]?.body))).toEqual({ stops: ['s2', 's1'], return_home: true })
    expect(screen.getAllByRole('row').length).toBeGreaterThan(2)
  })

  it('falls back to the fixture route with a notice on a planner error', async () => {
    liveSetup()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/route')
        ? jsonResponse(422, { detail: 'unknown stop: s3' })
        : new Response(null, { status: 404 }),
    )
    render(<RouteSheet />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Return to safe haven' }))
    fireEvent.click(screen.getByRole('button', { name: 'Plan route' }))
    expect((await screen.findByRole('status')).textContent).toBe(
      'Planner: unknown stop: s3. Showing the SYNTHETIC fixture route.',
    )
    expect(useMission.getState().route).toBe(fixtures.route)
    expect(screen.getByText('Simulation', { selector: '.pn-head .pn-prov' })).toBeTruthy()
  })

  it('uses the fixture route in DEMO mode without calling the planner', async () => {
    const s = useMission.getState()
    s.setDemo(true)
    s.setAoi(fixtures.aoi)
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }))
    render(<RouteSheet />)
    expect(screen.getByText('No route yet. Choose stops and press Plan route.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Plan route' }))
    expect(useMission.getState().route).toBe(fixtures.route)
    expect(screen.getByRole('status').textContent).toBe('DEMO: SYNTHETIC fixture route.')
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/route'))).toBe(false)
  })
})
