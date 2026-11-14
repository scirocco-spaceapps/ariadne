import { assetsUrl } from './config'
import { fixtureAssetUrl } from './fixtures'
import type { Aoi } from './types'

/**
 * URL of one AOI file (`aoi.rasters.*.file`, `aoi.vectors.*`). Live: VITE_ASSETS_URL + assets_base +
 * file. DEMO: the bundled SYNTHETIC fixture of the same name.
 */
export function assetUrl(aoi: Aoi, file: string, demo: boolean): string {
  if (demo) {
    const url = fixtureAssetUrl(file)
    if (url) return url
  }
  return assetsUrl + aoi.assets_base + file
}
