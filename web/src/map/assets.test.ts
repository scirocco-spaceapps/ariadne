import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Aoi } from '../lib/types'
import { bundledSource, remoteSource } from './assets'

afterEach(() => vi.unstubAllGlobals())

// fixtureSource() itself reads contracts/fixtures through import.meta.glob, which Vitest may only
// load once web/vite.config.ts allows ../contracts (N1). Its lookup logic is bundledSource.
describe('bundledSource', () => {
  const files = {
    '../../../contracts/fixtures/assets/slope_2m.png': '/@fs/x/slope_2m.png',
    '../../../contracts/fixtures/assets/track.geojson': '/@fs/x/track.geojson',
  }
  const src = bundledSource({ id: 'fixture-synthetic' } as Aoi, files, true)

  it('finds files by name and reports missing ones', async () => {
    expect(src.synthetic).toBe(true)
    expect(src.url('slope_2m.png')).toBe('/@fs/x/slope_2m.png')
    expect(await src.exists('track.geojson')).toBe(true)
    expect(await src.exists('geology.geojson')).toBe(false)
  })

  it('gives missing files a URL that fails to load instead of throwing', () => {
    expect(src.url('geology.geojson')).toBe('/missing-asset/geology.geojson')
  })
})

describe('remoteSource', () => {
  const aoi = { assets_base: 'bright-angel/' } as Aoi

  it('joins the asset root, assets_base and the file name', () => {
    expect(remoteSource(aoi, 'https://assets.example.org').url('ortho_1m.jpg')).toBe(
      'https://assets.example.org/bright-angel/ortho_1m.jpg',
    )
    expect(remoteSource(aoi, '/').url('a.png')).toBe('/bright-angel/a.png')
  })

  it('checks existence with a HEAD request and treats errors as missing', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: init?.method === 'HEAD' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await remoteSource(aoi, '/').exists('targets.geojson')).toBe(true)
    expect(fetchMock).toHaveBeenCalledWith('/bright-angel/targets.geojson', { method: 'HEAD' })

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))))
    expect(await remoteSource(aoi, '/').exists('targets.geojson')).toBe(false)
  })
})
