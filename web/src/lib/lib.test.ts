import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, missionControl, planner } from './api'
import { assetUrl } from './assets'
import { isDemo, wsUrl } from './config'
import { fixtures } from './fixtures'
import { connectSession, type SocketStatus } from './socket'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('config', () => {
  it('builds the ws URL through the dev proxy', () => {
    expect(wsUrl('ab c', 'cuff', { protocol: 'https:', host: 'x.app' })).toBe('wss://x.app/ws?s=ab%20c&role=cuff')
    expect(wsUrl('id', 'console', { protocol: 'http:', host: 'localhost:5173' })).toBe(
      'ws://localhost:5173/ws?s=id&role=console',
    )
  })

  it('reads ?demo=1', () => {
    expect(isDemo('?demo=1')).toBe(true)
    expect(isDemo('?s=abc')).toBe(false)
  })
})

describe('fixtures', () => {
  it('bundles the SYNTHETIC replay with states and events', () => {
    const states = fixtures.frames.filter((f) => f.type === 'state')
    expect(states.length).toBe(60)
    expect(fixtures.frames.some((f) => f.type === 'event' && f.name === 'storm_alert')).toBe(true)
  })

  it('resolves fixture assets in DEMO mode and the asset host otherwise', () => {
    expect(assetUrl(fixtures.aoi, 'ortho_1m.jpg', true)).toMatch(/ortho_1m\.jpg/)
    expect(assetUrl(fixtures.aoi, 'ortho_1m.jpg', false)).toBe('/' + fixtures.aoi.assets_base + 'ortho_1m.jpg')
  })
})

describe('api', () => {
  it('posts JSON and returns the body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'abc' }, { status: 201 }))
    const res = await missionControl.createSession({ route: fixtures.route, budget_min: 1, reserve_min: 0, dwell_min: 0 })
    expect(res.id).toBe('abc')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/mc/sessions')
    expect(init?.method).toBe('POST')
  })

  it('turns an error body into ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ detail: 'stop s9 unreachable' }, { status: 422 }))
    const err = await planner.route({ stops: ['s9'], return_home: true }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).status).toBe(422)
    expect((err as ApiError).detail).toBe('stop s9 unreachable')
  })
})

/** Minimal WebSocket stand-in driven by the test. */
class FakeSocket {
  static all: FakeSocket[] = []
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  url: string
  constructor(url: string) {
    this.url = url
    FakeSocket.all.push(this)
  }
  send(s: string) {
    this.sent.push(s)
  }
  close() {
    this.onclose?.({ code: 1000 })
  }
}

describe('socket', () => {
  it('sends hello, delivers frames and reconnects with backoff', () => {
    vi.useFakeTimers()
    FakeSocket.all = []
    const got: unknown[] = []
    const statuses: SocketStatus[] = []
    const sock = connectSession({
      url: 'ws://x/ws?s=1&role=cuff',
      role: 'cuff',
      onMessage: (m) => got.push(m),
      onStatus: (s) => statuses.push(s),
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      minDelayMs: 100,
    })
    const first = FakeSocket.all[0]
    first.onopen?.()
    expect(JSON.parse(first.sent[0])).toEqual({ type: 'hello', role: 'cuff' })
    first.onmessage?.({ data: JSON.stringify(fixtures.frames[0]) })
    expect(got).toHaveLength(1)

    first.onclose?.({ code: 1006 })
    expect(FakeSocket.all).toHaveLength(1)
    vi.advanceTimersByTime(100)
    expect(FakeSocket.all).toHaveLength(2)
    FakeSocket.all[1].onopen?.()
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting', 'reconnecting', 'open'])

    sock.close()
    vi.advanceTimersByTime(10_000)
    expect(FakeSocket.all).toHaveLength(2)
    expect(statuses.at(-1)).toBe('closed')
  })

  it('kick drops the current socket and reconnects at once', () => {
    vi.useFakeTimers()
    FakeSocket.all = []
    const got: unknown[] = []
    const statuses: SocketStatus[] = []
    const sock = connectSession({
      url: 'ws://x',
      role: 'console',
      onMessage: (m) => got.push(m),
      onStatus: (s) => statuses.push(s),
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
      minDelayMs: 100,
    })
    const first = FakeSocket.all[0]
    first.onopen?.()
    sock.kick()
    expect(FakeSocket.all).toHaveLength(2)
    // The dropped socket's close does not schedule another reconnect, and its frames are ignored.
    vi.advanceTimersByTime(10_000)
    expect(FakeSocket.all).toHaveLength(2)
    first.onmessage?.({ data: JSON.stringify(fixtures.frames[0]) })
    expect(got).toHaveLength(0)
    FakeSocket.all[1].onopen?.()
    expect(statuses).toEqual(['connecting', 'open', 'reconnecting', 'open'])
    sock.close()
    sock.kick()
    expect(FakeSocket.all).toHaveLength(2)
  })

  it('stops on 4404', () => {
    vi.useFakeTimers()
    FakeSocket.all = []
    const statuses: string[] = []
    connectSession({
      url: 'ws://x',
      role: 'console',
      onMessage: () => {},
      onStatus: (s, d) => statuses.push(d ? `${s}:${d}` : s),
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    })
    FakeSocket.all[0].onclose?.({ code: 4404 })
    vi.advanceTimersByTime(10_000)
    expect(FakeSocket.all).toHaveLength(1)
    expect(statuses.at(-1)).toBe('rejected:unknown session')
  })
})
