import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtures } from '../lib/fixtures'
import { calmTicks, DEMO_TICK_MS, startDemo, ticks } from './demo'
import { useMission } from './store'

const stormy = (g: ReturnType<typeof ticks>[number]) =>
  g.some((f) => (f.type === 'event' && f.name === 'storm_alert') || (f.type === 'state' && f.alert !== null))

afterEach(() => {
  vi.useRealTimers()
})

describe('calmTicks', () => {
  const all = ticks(fixtures.frames)

  it('the full fixture still has the storm alert (DEMO mode and the e2e test rely on it)', () => {
    expect(all.some(stormy)).toBe(true)
  })

  it('keeps only the ticks before the first storm alert', () => {
    const calm = calmTicks(all)
    expect(calm.length).toBeGreaterThan(0)
    expect(calm.some(stormy)).toBe(false)
    expect(stormy(all[calm.length])).toBe(true) // stops right at the alert
  })

  it('returns everything when there is no alert', () => {
    const quiet = calmTicks(all).slice(0, 5)
    expect(calmTicks(quiet)).toEqual(quiet)
  })
})

describe('startDemo', () => {
  /** Runs a replay for two full loops of the whole fixture and records every alert it shows. */
  function alertsShown(opts?: { calm?: boolean }): unknown[] {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    const seen: unknown[] = []
    const unsub = useMission.subscribe((s) => seen.push(s.session.state?.alert ?? null))
    const stop = startDemo(opts)
    vi.advanceTimersByTime(2 * (ticks(fixtures.frames).length + 6) * DEMO_TICK_MS)
    stop()
    unsub()
    return seen.filter((a) => a !== null)
  }

  it('the fallback (calm) never puts a storm alert on screen', () => {
    expect(alertsShown({ calm: true })).toEqual([])
  })

  it('DEMO mode still plays the storm alert', () => {
    expect(alertsShown().length).toBeGreaterThan(0)
  })
})
