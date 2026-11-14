import { describe, expect, it } from 'vitest'
import { legRequests, mapLimit, LEG_CONCURRENCY } from './useReplan'

const tick = () => new Promise((r) => setTimeout(r, 1))

describe('mapLimit', () => {
  it('keeps at most `limit` calls in flight and returns results in input order', async () => {
    let inFlight = 0
    let peak = 0
    const items = legRequests(['a', 'b', 'c', 'd', 'e'])
    expect(items).toHaveLength(15)
    const out = await mapLimit(items, LEG_CONCURRENCY, async (s) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await tick()
      inFlight--
      return s.join('-')
    })
    expect(peak).toBe(LEG_CONCURRENCY)
    expect(out).toEqual(items.map((s) => s.join('-')))
  })

  it('tries a failed call once more', async () => {
    const calls: Record<number, number> = {}
    const out = await mapLimit([1, 2, 3], 2, async (n) => {
      calls[n] = (calls[n] ?? 0) + 1
      if (n === 2 && calls[n] === 1) throw new Error('planning took longer than 5 s')
      return n * 10
    })
    expect(out).toEqual([10, 20, 30])
    expect(calls).toEqual({ 1: 1, 2: 2, 3: 1 })
  })

  it('rejects when the retry fails too', async () => {
    await expect(
      mapLimit([1, 2], 2, async (n) => {
        if (n === 2) throw new Error('422')
        return n
      }),
    ).rejects.toThrow('422')
  })

  it('does not retry or start new calls after the signal is aborted', async () => {
    const ctl = new AbortController()
    let calls = 0
    const job = mapLimit(
      [1, 2, 3, 4],
      1,
      async () => {
        calls++
        ctl.abort()
        throw new DOMException('Aborted', 'AbortError')
      },
      ctl.signal,
    )
    await expect(job).rejects.toThrow('Aborted')
    expect(calls).toBe(1)
  })
})
