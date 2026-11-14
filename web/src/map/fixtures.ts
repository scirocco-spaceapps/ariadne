// SYNTHETIC fixture source. Kept apart from assets.ts because these globs reach outside web/:
// the dev server (and Vitest) can load them only when vite.config.ts allows ../contracts.

import type { Aoi } from '../lib/types'
import { bundledSource, type AssetSource } from './assets'

const fixtureAoi = import.meta.glob<Aoi>('../../../contracts/fixtures/aoi.json', {
  eager: true,
  import: 'default',
})
const fixtureFiles = import.meta.glob<string>(['../../../contracts/fixtures/assets/*', '!**/README.md'], {
  eager: true,
  query: '?url',
  import: 'default',
})

/** SYNTHETIC fixture AOI from contracts/fixtures (500 x 400 m). */
export function fixtureSource(): AssetSource {
  const aoi = Object.values(fixtureAoi)[0]
  if (!aoi) throw new Error('contracts/fixtures/aoi.json not found')
  return bundledSource(aoi, fixtureFiles, true)
}
