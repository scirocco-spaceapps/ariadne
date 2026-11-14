import { act, cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { missionControl } from '../lib/api'
import { aoi as realAoi, fixtures } from '../lib/fixtures'
import type { RouteResponse, WsState } from '../lib/types'
import { sessionBody } from '../panels/session'
import { useSessionRecovery } from './bootstrap'
import {
  FALLBACK_AFTER_MS,
  RECREATE_RETRY_MS,
  enterFallback,
  healthFailed,
  healthOk,
  linkBanner,
  recreateSession,
  resetLink,
  sessionLost,
  setLiveId,
  socketMessage,
  socketStatus,
  tick,
  useLink,
} from './link'
import { useMission } from './store'

const fxState = fixtures.frames.find((f) => f.type === 'state') as WsState
/** A live route that is not the fixture's, so a restore is told apart from the DEMO replay. */
const liveRoute: RouteResponse = { ...fixtures.route, totals: { ...fixtures.route.totals, eva_min: 219.65 } }
const budget = { budget_min: 240, reserve_min: 30 }

function live(over: Partial<WsState> = {}): WsState {
  return { ...fxState, session: 'live-1', t_min: 42, running: true, speed: 6, alert: null, ...over }
}

/** A console that has been live on session live-1 with the real AOI and a planned route. */
function goLive(state: WsState = live()) {
  const m = useMission.getState()
  m.setAoi(realAoi)
  m.setRoute(liveRoute)
  m.setBudget(budget)
  m.setConditions(fixtures.conditions)
  m.setSessionId('live-1')
  setLiveId('live-1')
  socketStatus('connecting', undefined, 0)
  socketStatus('open', undefined, 50)
  socketMessage(state, 100)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  useMission.getState().reset()
  resetLink()
})

afterEach(() => {
  cleanup()
  resetLink()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('fallback', () => {
  it('switches to the DEMO replay after 10 s down and back on the first live frame', () => {
    goLive()
    socketStatus('reconnecting', undefined, 1_000)
    expect(useMission.getState().session.status).toBe('reconnecting')

    tick(1_000 + FALLBACK_AFTER_MS - 100)
    expect(useLink.getState().fallback).toBe(false)
    expect(useMission.getState().demo).toBe(false)

    tick(1_000 + FALLBACK_AFTER_MS)
    const fb = useMission.getState()
    expect(useLink.getState().fallback).toBe(true)
    expect(fb.demo).toBe(true)
    expect(fb.route).toEqual(fixtures.route)
    // The socket's status no longer reaches the DEMO screen.
    socketStatus('reconnecting', undefined, 12_000)
    expect(useMission.getState().session.status).toBe('open')

    const back = live({ t_min: 55 })
    socketStatus('open', undefined, 20_000)
    socketMessage(back, 20_050)
    const m = useMission.getState()
    expect(useLink.getState().fallback).toBe(false)
    expect(m.demo).toBe(false)
    expect(m.aoi).toBe(realAoi)
    expect(m.route).toBe(liveRoute)
    expect(m.conditions).toBe(fixtures.conditions)
    expect(m.session).toMatchObject({ id: 'live-1', state: back, status: 'open' })
    expect(useLink.getState().notice?.kind).toBe('reconnected')
  })

  it('does not fall back without a live session', () => {
    socketStatus('reconnecting', undefined, 0)
    tick(FALLBACK_AFTER_MS * 2)
    expect(useLink.getState().fallback).toBe(false)
  })

  it('kicks a running link that went quiet, once per stale period, and never a paused one', () => {
    goLive(live({ running: true }))
    expect(tick(2_000)).toBe(false)
    expect(tick(3_200)).toBe(true)
    // The outage counts from the last frame (T+100 ms), so the fallback is 10 s after it.
    expect(useLink.getState().downSince).toBe(100)
    expect(tick(3_300)).toBe(false)

    resetLink()
    goLive(live({ running: false }))
    expect(tick(60_000)).toBe(false)
  })

  it('a paused session is watched through /health', () => {
    goLive(live({ running: false }))
    healthOk('live-1', 5_000)
    expect(healthFailed('other')).toBe(false)
    expect(healthFailed('live-1')).toBe(true)
    expect(useLink.getState().downSince).toBe(5_000)
    tick(5_000 + FALLBACK_AFTER_MS)
    expect(useLink.getState().fallback).toBe(true)
    // Once the socket is reconnecting there is nothing left to kick.
    socketStatus('reconnecting', undefined, 15_100)
    expect(healthFailed('live-1')).toBe(false)
  })
})

describe('restart recovery', () => {
  it('recognises a lost session only after it had been live', () => {
    const lost = { status: 'rejected' as const, detail: 'unknown session', liveId: 'live-1' }
    expect(sessionLost({ ...lost, everLive: true })).toBe(true)
    expect(sessionLost({ ...lost, everLive: false })).toBe(false) // a stale ?s on page load
    expect(sessionLost({ ...lost, detail: 'bad role', everLive: true })).toBe(false)
  })

  it('recreates the session at the same time, speed and storm', async () => {
    goLive(live({ t_min: 42, running: true, speed: 12, alert: { type: 'storm_alert', lead_min: 30, since_t: 30 } }))
    const create = vi.spyOn(missionControl, 'createSession').mockResolvedValue({ id: 'new-1' })
    const control = vi.spyOn(missionControl, 'control').mockResolvedValue({ ok: true })
    const event = vi.spyOn(missionControl, 'event').mockResolvedValue({ ok: true })

    await expect(recreateSession()).resolves.toEqual({ id: 'new-1', t_min: 42 })
    expect(create).toHaveBeenCalledWith(sessionBody(liveRoute, budget, realAoi))
    expect(control.mock.calls).toEqual([
      ['new-1', { action: 'seek', t_min: 42 }],
      ['new-1', { action: 'start', speed: 12 }],
    ])
    // 30 min lead raised at T+30, now T+42: 18 min left.
    expect(event).toHaveBeenCalledWith('new-1', { type: 'storm_alert', lead_min: 18 })
  })

  it('uses the route kept for the fallback when the restart took longer than 10 s', async () => {
    goLive(live({ running: false }))
    enterFallback()
    expect(useMission.getState().route).toEqual(fixtures.route)
    const create = vi.spyOn(missionControl, 'createSession').mockResolvedValue({ id: 'new-2' })
    vi.spyOn(missionControl, 'control').mockResolvedValue({ ok: true })
    await recreateSession()
    expect(create).toHaveBeenCalledWith(sessionBody(liveRoute, budget, realAoi))
  })
})

/** Mounts the recovery hook and shows the router's search, as the console does. */
function Probe({ role }: { role: 'console' | 'cuff' }) {
  useSessionRecovery(role)
  return createElement('output', { 'data-testid': 'search' }, useLocation().search)
}

function loseSession() {
  act(() => socketStatus('rejected', 'unknown session', 30_000))
}

describe('useSessionRecovery', () => {
  it('console: retries until mission-control is back, then follows the new id', async () => {
    goLive()
    const create = vi
      .spyOn(missionControl, 'createSession')
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValue({ id: 'new-1' })
    vi.spyOn(missionControl, 'control').mockResolvedValue({ ok: true })
    const view = render(createElement(MemoryRouter, { initialEntries: ['/?s=live-1'] }, createElement(Probe, { role: 'console' })))

    loseSession()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(create).toHaveBeenCalledTimes(1)
    await act(() => vi.advanceTimersByTimeAsync(RECREATE_RETRY_MS))
    expect(create).toHaveBeenCalledTimes(2)

    expect(useLink.getState().liveId).toBe('new-1')
    expect(useLink.getState().notice).toMatchObject({ kind: 'restored', t_min: 42 })
    expect(view.getByTestId('search').textContent).toBe('?s=new-1')
  })

  it('console without a route gives up at once', async () => {
    goLive()
    useMission.getState().setRoute(null)
    const create = vi.spyOn(missionControl, 'createSession')
    render(createElement(MemoryRouter, null, createElement(Probe, { role: 'console' })))
    loseSession()
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(create).not.toHaveBeenCalled()
    expect(useLink.getState().notice?.kind).toBe('lost')
  })

  it('cuff: falls back to DEMO and asks for the new QR', () => {
    goLive()
    const create = vi.spyOn(missionControl, 'createSession')
    render(createElement(MemoryRouter, null, createElement(Probe, { role: 'cuff' })))
    loseSession()
    expect(create).not.toHaveBeenCalled()
    expect(useLink.getState().fallback).toBe(true)
    expect(useMission.getState().demo).toBe(true)
    expect(linkBanner(useLink.getState(), 'cuff', 31_000)?.text).toMatch(/scan the new QR/)
  })
})

describe('banner', () => {
  const base = useLink.getState()

  it('stays quiet while connected and during a normal first connect', () => {
    expect(linkBanner({ ...base, liveId: 'a', status: 'open' }, 'console', 0)).toBeNull()
    expect(linkBanner({ ...base, liveId: 'a', status: 'connecting', downSince: 0 }, 'console', 1_000)).toBeNull()
    expect(linkBanner({ ...base, liveId: null, downSince: 0 }, 'console', 60_000)).toBeNull()
  })

  it('counts down to the fallback, then says DEMO DATA', () => {
    const down = { ...base, liveId: 'a', everLive: true, status: 'reconnecting' as const, downSince: 0 }
    expect(linkBanner(down, 'console', 3_200)).toEqual({
      tone: 'warn',
      text: 'Lost mission-control · reconnecting · DEMO DATA in 7 s',
    })
    expect(linkBanner({ ...down, everLive: false }, 'cuff', 2_000)?.text).toBe(
      'Cannot reach mission-control · reconnecting · DEMO DATA in 8 s',
    )
    expect(linkBanner({ ...down, fallback: true }, 'cuff', 11_000)).toEqual({
      tone: 'bad',
      text: 'Mission-control unreachable · showing DEMO DATA · reconnecting',
    })
  })

  it('reports the recovery briefly', () => {
    const ok = { ...base, liveId: 'a', everLive: true, status: 'open' as const }
    const reconnected = { ...ok, notice: { kind: 'reconnected' as const, at: 0 } }
    expect(linkBanner(reconnected, 'cuff', 1_000)?.text).toBe('Reconnected · session resumed')
    expect(linkBanner(reconnected, 'cuff', 3_000)).toBeNull()
    const restored = { ...ok, liveId: 'b', everLive: false, downSince: 0, notice: { kind: 'restored' as const, at: 0, t_min: 42 } }
    expect(linkBanner(restored, 'console', 5_000)?.text).toBe(
      'Mission-control restarted · session restored at T+ 0:42 · pair the cuff again',
    )
  })
})
