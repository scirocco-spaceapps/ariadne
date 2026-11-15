import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSmoothed, type Smoothable } from './smooth'

afterEach(() => vi.restoreAllMocks())

describe('useSmoothed', () => {
  it('returns the target as is when disabled', () => {
    const t: Smoothable = { marker: [10, 20], s: 5 }
    const { result } = renderHook(() => useSmoothed(t, false))
    expect(result.current).toBe(t)
  })

  it('never leaves the segment between the last shown value and the target', () => {
    let now = 1000
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    // A frame queue that honours cancelAnimationFrame, run one frame at a time.
    const queue = new Map<number, FrameRequestCallback>()
    let nextId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => (queue.set(++nextId, cb), nextId))
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => void queue.delete(id))
    const frames = {
      shift: () => {
        const [id, cb] = queue.entries().next().value!
        queue.delete(id)
        return cb
      },
    }
    const { result, rerender } = renderHook(({ t }) => useSmoothed(t, true), {
      initialProps: { t: { marker: [0, 0], s: 0 } as Smoothable },
    })
    now = 1500
    rerender({ t: { marker: [100, 0], s: 100 } })
    // A frame stamped before the effect ran (the bug): the marker must not move backwards.
    act(() => frames.shift()!(now - 300))
    expect(result.current.marker![0]).toBeGreaterThanOrEqual(0)
    now += 250
    act(() => frames.shift()!(now))
    expect(result.current.marker![0]).toBeCloseTo(50, 0)
    now += 1000
    act(() => frames.shift()!(now))
    expect(result.current.marker).toEqual([100, 0])
    expect(result.current.s).toBe(100)
  })

  it('snaps on a large jump', () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothed(t, true), {
      initialProps: { t: { marker: [0, 0], s: 0 } as Smoothable },
    })
    rerender({ t: { marker: [1000, 0], s: 1000 } })
    expect(result.current.marker).toEqual([1000, 0])
  })
})
