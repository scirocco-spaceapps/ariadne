import { describe, expect, it } from 'vitest'
import type { GeologyCollection, TrackCollection, WaypointCollection } from '../lib/types'
import { linePaths, pointFeatures, polygonLabelPoint, unitPolygons } from './geo'

const meta = { type: 'FeatureCollection' as const, provenance: 'Simulation' as const, source: 'test' }

describe('linePaths', () => {
  it('turns LineString and MultiLineString features into paths', () => {
    const fc: TrackCollection = {
      ...meta,
      features: [
        { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [10, 5]] }, properties: { sol: 1 } },
        {
          type: 'Feature',
          geometry: { type: 'MultiLineString', coordinates: [[[1, 1], [2, 2]], [[3, 3], [4, 4], [5, 5]]] },
          properties: {},
        },
      ],
    }
    expect(linePaths(fc)).toEqual([
      [[0, 0], [10, 5]],
      [[1, 1], [2, 2]],
      [[3, 3], [4, 4], [5, 5]],
    ])
  })

  it('drops paths with fewer than two points', () => {
    const fc: TrackCollection = {
      ...meta,
      features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 1]] }, properties: {} }],
    }
    expect(linePaths(fc)).toEqual([])
  })
})

describe('pointFeatures', () => {
  it('keeps position and properties', () => {
    const fc: WaypointCollection = {
      ...meta,
      features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [12, 34] }, properties: { sol: 1250 } }],
    }
    expect(pointFeatures(fc)).toEqual([{ xy: [12, 34], properties: { sol: 1250 } }])
  })
})

describe('unitPolygons and polygonLabelPoint', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
  const fc: GeologyCollection = {
    ...meta,
    features: [
      { type: 'Feature', geometry: { type: 'Polygon', coordinates: [square] }, properties: { unit: 'Jf', name: 'Floor' } },
      {
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates: [[square], [[[20, 20], [30, 20], [30, 30], [20, 20]]]] },
        properties: { unit: 'Ba', name: 'Bright Angel' },
      },
    ],
  }

  it('splits MultiPolygon parts and keeps unit and name', () => {
    const polys = unitPolygons(fc)
    expect(polys).toHaveLength(3)
    expect(polys.map((p) => p.unit)).toEqual(['Jf', 'Ba', 'Ba'])
    expect(polys[0].rings[0]).toHaveLength(5)
  })

  it('anchors labels inside the outer ring', () => {
    const [x, y] = polygonLabelPoint([square])!
    expect(x).toBeGreaterThan(0)
    expect(x).toBeLessThan(10)
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(10)
    expect(polygonLabelPoint([])).toBeNull()
  })
})
