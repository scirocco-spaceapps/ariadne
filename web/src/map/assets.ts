// Where the map gets its AOI definition and asset URLs.
// Rule (docs/PLAN_CHANGES.md): URL = assets root + aoi.assets_base + file.

import type { Aoi } from '../lib/types'

export type AssetSource = {
  aoi: Aoi
  /** Absolute or root-relative URL of a file listed in aoi.json. */
  url: (file: string) => string
  /** True for the SYNTHETIC fixtures; layers then carry provenance Simulation. */
  synthetic: boolean
}

/** Real data: assetsUrl is the asset root, e.g. import.meta.env.VITE_ASSETS_URL. */
export function remoteSource(aoi: Aoi, assetsUrl: string): AssetSource {
  const root = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  return { aoi, url: (file) => `${root}${aoi.assets_base}${file}`, synthetic: false }
}

const fixtureAoi = import.meta.glob<Aoi>('../../../contracts/fixtures/aoi.json', {
  eager: true,
  import: 'default',
})
const fixtureFiles = import.meta.glob<string>('../../../contracts/fixtures/assets/*', {
  eager: true,
  query: '?url',
  import: 'default',
})

/** SYNTHETIC fixture AOI from contracts/fixtures (500 x 400 m). */
export function fixtureSource(): AssetSource {
  const aoi = Object.values(fixtureAoi)[0]
  if (!aoi) throw new Error('contracts/fixtures/aoi.json not found')
  const byName = new Map(
    Object.entries(fixtureFiles).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]),
  )
  return {
    aoi,
    url: (file) => {
      const found = byName.get(file)
      if (!found) throw new Error(`fixture asset ${file} not found in contracts/fixtures/assets/`)
      return found
    },
    synthetic: true,
  }
}
