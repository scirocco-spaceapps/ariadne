import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Aoi } from '../lib/types'
import type { AssetSource } from './assets'
import { useSiteData } from './useSiteData'

const aoi = {
  size_m: [500, 400],
  assets_base: 'a/',
  rasters: { seen_not_touched: { file: 'seen_not_touched_2m.png', px_m: 2, optional: true } },
  vectors: {
    track: 'track.geojson',
    waypoints: 'waypoints.geojson',
    targets: { file: 'targets.geojson', optional: true },
  },
} as unknown as Aoi

const source = (exists: (f: string) => Promise<boolean>): AssetSource => ({
  aoi,
  url: (f) => `https://assets.test/a/${f}`,
  exists,
  synthetic: false,
})

afterEach(() => vi.unstubAllGlobals())

describe('useSiteData (Y7 assets)', () => {
  it('leaves targets null and seen false when the optional assets are missing', async () => {
    const fetchMock = vi.fn(async () => new Response('not found', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)
    const src = source(async () => false)
    const { result } = renderHook(() => useSiteData(src))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2)) // track and waypoints only
    expect(result.current.targets).toBeNull()
    expect(result.current.seen).toBe(false)
  })

  it('survives a failing existence check and a broken targets file', async () => {
    const fetchMock = vi.fn(async () => new Response('{oops', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const src = source(async (f) => (f.endsWith('.png') ? Promise.reject(new Error('network')) : true))
    const { result } = renderHook(() => useSiteData(src))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(result.current.targets).toBeNull()
    expect(result.current.seen).toBe(false)
  })

  it('loads the targets and sees the raster when both are there', async () => {
    const fc = { type: 'FeatureCollection', provenance: 'Derived', source: 't', features: [] }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fc))))
    const src = source(async () => true)
    const { result } = renderHook(() => useSiteData(src))
    await waitFor(() => expect(result.current.seen).toBe(true))
    expect(result.current.targets?.type).toBe('FeatureCollection')
  })
})
