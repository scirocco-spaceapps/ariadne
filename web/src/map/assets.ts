// Where the map gets its AOI definition and asset URLs.
// Rule (docs/PLAN_CHANGES.md): URL = assets root + aoi.assets_base + file.

import type { Aoi } from '../lib/types'

export type AssetSource = {
  aoi: Aoi
  /** Absolute or root-relative URL of a file listed in aoi.json. */
  url: (file: string) => string
  /** Resolves true when the file can be loaded; used to hide toggles of missing optional assets. */
  exists: (file: string) => Promise<boolean>
  /** True for the SYNTHETIC fixtures; layers then carry provenance Simulation. */
  synthetic: boolean
}

/** Real data: assetsUrl is the asset root, e.g. import.meta.env.VITE_ASSETS_URL. */
export function remoteSource(aoi: Aoi, assetsUrl: string): AssetSource {
  const root = assetsUrl.endsWith('/') ? assetsUrl : `${assetsUrl}/`
  const url = (file: string) => `${root}${aoi.assets_base}${file}`
  return {
    aoi,
    url,
    exists: async (file) => {
      try {
        return (await fetch(url(file), { method: 'HEAD' })).ok
      } catch {
        return false
      }
    },
    synthetic: false,
  }
}

/**
 * A source backed by a fixed set of bundled files ({path: url}, e.g. from import.meta.glob).
 * Unknown files get a URL that 404s, like a missing file on the asset host.
 */
export function bundledSource(aoi: Aoi, files: Record<string, string>, synthetic: boolean): AssetSource {
  const byName = new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1), url]))
  return {
    aoi,
    url: (file) => byName.get(file) ?? `/missing-asset/${file}`,
    exists: async (file) => byName.has(file),
    synthetic,
  }
}
