import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtures } from '../lib/fixtures'
import type { Aoi, WsState } from '../lib/types'
import type { AssetSource } from './assets'
import {
  ENVELOPE_COLORS,
  envelopeImage,
  envelopeMode,
  envelopePixels,
  envelopeThresholds,
  loadCostRaster,
  makeMarginAt,
  marginAt,
  marginClass,
  minutesToStorm,
  quantizeT,
  reachableShare,
  shareWithin,
  stormMarginAt,
  stormPixels,
  timeToStorm,
  type CostRaster,
} from './envelope'

// 3 x 2 cells of 10 m over a 30 x 20 m AOI. Row 0 is the north edge (y 10..20).
//   row 0: 10  20  NaN
//   row 1:  5  15   25
const cost: CostRaster = {
  data: new Float32Array([10, 20, NaN, 5, 15, 25]),
  cols: 3,
  rows: 2,
  px_m: 10,
  size_m: [30, 20],
}
const model = { budget_min: 100, reserve_min: 30 }
// margin = (100 - t) - 30 - cost = 70 - t - cost

describe('marginAt', () => {
  it('reads the cell under a point, north-up', () => {
    expect(marginAt(cost, model, 5, 15, 0)).toBe(60) // row 0, col 0: cost 10
    expect(marginAt(cost, model, 15, 15, 0)).toBe(50) // row 0, col 1: cost 20
    expect(marginAt(cost, model, 5, 5, 0)).toBe(65) // row 1, col 0: cost 5
    expect(marginAt(cost, model, 25, 5, 0)).toBe(45) // row 1, col 2: cost 25
  })

  it('is null on an unreachable (NaN) cell', () => {
    expect(marginAt(cost, model, 25, 15, 0)).toBeNull()
  })

  it('handles the AOI edges and corners', () => {
    expect(marginAt(cost, model, 0, 0, 0)).toBe(65) // south-west corner -> row 1, col 0
    expect(marginAt(cost, model, 30, 0, 0)).toBe(45) // south-east corner -> last col, last row
    expect(marginAt(cost, model, 0, 20, 0)).toBe(60) // north-west corner -> row 0, col 0
    expect(marginAt(cost, model, 30, 20, 0)).toBeNull() // north-east corner is the NaN cell
    expect(marginAt(cost, model, 30, 5, 0)).toBe(45) // east edge belongs to the last column
    expect(marginAt(cost, model, 15, 0, 0)).toBe(55) // south edge belongs to the last row
  })

  it('is null just outside the AOI', () => {
    expect(marginAt(cost, model, -0.01, 5, 0)).toBeNull()
    expect(marginAt(cost, model, 30.01, 5, 0)).toBeNull()
    expect(marginAt(cost, model, 5, -0.01, 0)).toBeNull()
    expect(marginAt(cost, model, 5, 20.01, 0)).toBeNull()
  })

  it('shrinks one minute per minute of EVA time', () => {
    expect(marginAt(cost, model, 5, 15, 25)).toBe(35)
    expect(marginAt(cost, model, 5, 15, 70)).toBe(-10)
    expect(makeMarginAt(cost, model)(5, 15, 25)).toBe(35)
  })
})

describe('classes and thresholds', () => {
  it('takes both thresholds from the model', () => {
    expect(envelopeThresholds(model)).toEqual({ safe_min: 30, tight_min: 0 })
    expect(envelopeThresholds({ budget_min: 360, reserve_min: 60 }).safe_min).toBe(60)
  })

  it('classes margins at the reserve and at zero', () => {
    expect(marginClass(30, model)).toBe('safe')
    expect(marginClass(29.9, model)).toBe('tight')
    expect(marginClass(0, model)).toBe('tight')
    expect(marginClass(-0.1, model)).toBe('out')
    expect(marginClass(null, model)).toBe('out')
  })

  it('floors time to half minutes', () => {
    expect(quantizeT(12.74)).toBe(12.5)
    expect(quantizeT(12.5)).toBe(12.5)
    expect(quantizeT(-3)).toBe(0)
  })
})

describe('envelopePixels', () => {
  const rgba = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const px = (img: { data: Uint8ClampedArray }, i: number) => Array.from(img.data.slice(i * 4, i * 4 + 3))

  it('colours every cell by its class, row 0 first', () => {
    // t = 20: margin = 50 - cost -> 40, 30, NaN, 45, 35, 25
    const img = envelopePixels(cost, model, 20)
    expect(img.width).toBe(3)
    expect(img.height).toBe(2)
    expect(px(img, 0)).toEqual(rgba(ENVELOPE_COLORS.safe))
    expect(px(img, 1)).toEqual(rgba(ENVELOPE_COLORS.safe)) // margin exactly R
    expect(px(img, 2)).toEqual(rgba(ENVELOPE_COLORS.out)) // NaN
    expect(px(img, 5)).toEqual(rgba(ENVELOPE_COLORS.tight)) // 25 < R
  })

  it('agrees with marginClass on every cell as time runs', () => {
    const colourOf = { safe: rgba(ENVELOPE_COLORS.safe), tight: rgba(ENVELOPE_COLORS.tight), out: rgba(ENVELOPE_COLORS.out) }
    for (const t of [0, 20, 40, 55, 65, 80]) {
      const img = envelopePixels(cost, model, t)
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const x = (col + 0.5) * 10
          const y = 20 - (row + 0.5) * 10
          const k = marginClass(marginAt(cost, model, x, y, t), model)
          expect(px(img, row * 3 + col)).toEqual(colourOf[k])
        }
      }
    }
  })
})

describe('loadCostRaster', () => {
  const aoi = {
    size_m: [30, 20],
    assets_base: 'a/',
    rasters: { cost_to_home: { file: 'cost_to_home_2m.f32', px_m: 10, dtype: 'float32', unit: 'min' } },
  } as unknown as Aoi
  const source = (name: string): AssetSource => ({
    aoi,
    url: (f) => `https://assets.test/${name}/${f}`,
    exists: async () => true,
    synthetic: true,
  })
  afterEach(() => vi.unstubAllGlobals())

  it('reads little-endian float32 and checks the size', async () => {
    const buf = new Float32Array([1, 2, 3, 4, 5, NaN]).buffer
    vi.stubGlobal('fetch', vi.fn(async () => new Response(buf)))
    const r = await loadCostRaster(source('good'))
    expect([r.cols, r.rows, r.px_m]).toEqual([3, 2, 10])
    expect(r.data[1]).toBe(2)
    expect(Number.isNaN(r.data[5])).toBe(true)
  })

  it('rejects a file of the wrong size', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Float32Array(5).buffer)))
    await expect(loadCostRaster(source('short'))).rejects.toThrow('expected 3 x 2')
  })

  it('loads the flat variant by key, and rejects a key aoi.json does not list', async () => {
    const withFlat = {
      ...aoi,
      rasters: {
        ...aoi.rasters,
        cost_to_home_flat: { file: 'cost_to_home_flat_2m.f32', px_m: 10, dtype: 'float32', unit: 'min', optional: true },
      },
    } as unknown as Aoi
    const fetchMock = vi.fn(async () => new Response(new Float32Array([1, 1, 1, 1, 1, 1]).buffer))
    vi.stubGlobal('fetch', fetchMock)
    const r = await loadCostRaster({ ...source('flat'), aoi: withFlat }, 'cost_to_home_flat')
    expect(r.data[0]).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith('https://assets.test/flat/cost_to_home_flat_2m.f32')
    await expect(loadCostRaster(source('none'), 'cost_to_home_flat')).rejects.toThrow('no rasters.cost_to_home_flat')
  })
})

describe('reachable share (Y9)', () => {
  // cost = 10 20 NaN / 5 15 25; margin >= 0  <=>  cost <= 70 - t
  it('counts finite cells within the limit over all AOI cells', () => {
    expect(shareWithin(cost, 15)).toBeCloseTo(3 / 6) // 10, 5, 15
    expect(shareWithin(cost, 4)).toBe(0)
    expect(shareWithin(cost, Infinity)).toBeCloseTo(5 / 6) // NaN never counts
  })

  it('shrinks as time passes, by the envelope rule', () => {
    expect(reachableShare(cost, model, 0)).toBeCloseTo(5 / 6)
    expect(reachableShare(cost, model, 50)).toBeCloseTo(4 / 6) // cost <= 20
    expect(reachableShare(cost, model, 60)).toBeCloseTo(2 / 6) // cost <= 10
    expect(reachableShare(cost, model, 70)).toBe(0)
  })

  it('is higher without obstacles: a flat raster with no blocked cell', () => {
    const flat: CostRaster = { ...cost, data: new Float32Array([10, 12, 14, 5, 11, 15]) }
    expect(reachableShare(flat, model, 50)).toBeGreaterThan(reachableShare(cost, model, 50))
  })

  it('uses the minutes left before the storm during an alert', () => {
    expect(reachableShare(cost, model, 0, 10)).toBeCloseTo(2 / 6) // cost <= 10, no reserve
  })
})

describe('storm alert (Y6)', () => {
  const states = fixtures.frames.filter((f): f is WsState => f.type === 'state')
  const at = (t: number) => states.find((s) => s.t_min === t)!
  const rgba = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const px = (img: { data: Uint8ClampedArray }, i: number) => Array.from(img.data.slice(i * 4, i * 4 + 3))

  it('counts the minutes left before the storm from the contract formula', () => {
    const alert = at(30).alert!
    expect(alert).toEqual({ type: 'storm_alert', lead_min: 25, since_t: 30 })
    expect(timeToStorm(alert, 30)).toBe(25)
    expect(timeToStorm(alert, 38)).toBe(17)
    expect(timeToStorm(alert, 80)).toBe(0) // floored at 0
    expect(minutesToStorm(25, 30, 31.5)).toBe(23.5)
  })

  it('switches mode only while the state carries an alert', () => {
    expect(envelopeMode(null)).toEqual({ kind: 'normal' })
    expect(envelopeMode(at(29))).toEqual({ kind: 'normal' })
    expect(envelopeMode(at(30))).toEqual({ kind: 'storm', minutes_left: 25 })
    expect(envelopeMode(at(49))).toEqual({ kind: 'storm', minutes_left: 6 })
    expect(envelopeMode(at(50))).toEqual({ kind: 'normal' }) // cleared
  })

  it('shows home-before-the-storm cells in amber and dims the rest', () => {
    // costs 10 20 NaN / 5 15 25; 17 min left -> 10, 5, 15 amber; 20, 25, NaN dim
    const img = stormPixels(cost, 17)
    const amber = rgba(ENVELOPE_COLORS.tight)
    const dim = rgba(ENVELOPE_COLORS.out)
    expect([0, 1, 2, 3, 4, 5].map((i) => px(img, i))).toEqual([amber, dim, dim, amber, amber, dim])
    expect(stormMarginAt(cost, 5, 15, 17)).toBe(7)
    expect(stormMarginAt(cost, 25, 15, 17)).toBeNull()
  })

  it('enters storm mode and comes back without leaking either way (fixture replay)', () => {
    const image = (s: WsState) => envelopeImage(cost, model, s.t_min, envelopeMode(s))
    // normal -> storm
    expect(image(at(29)).data).toEqual(envelopePixels(cost, model, 29).data)
    expect(image(at(30)).data).toEqual(stormPixels(cost, 25).data)
    expect(image(at(38)).data).toEqual(stormPixels(cost, 17).data) // shrinks as the storm nears
    // storm -> normal: identical to never having had an alert
    expect(image(at(50)).data).toEqual(envelopePixels(cost, model, 50).data)
    expect(image(at(50)).data).not.toEqual(image(at(49)).data)
  })
})
