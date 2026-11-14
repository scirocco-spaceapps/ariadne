// Contract files bundled into the app. contracts/aoi.json is the real AOI; everything under
// contracts/fixtures/ is SYNTHETIC and only used in DEMO mode.
import aoiRaw from '../../../contracts/aoi.json?raw'
import fxAoiRaw from '../../../contracts/fixtures/aoi.json?raw'
import fxConditionsRaw from '../../../contracts/fixtures/conditions.json?raw'
import fxRouteRaw from '../../../contracts/fixtures/route.json?raw'
import fxStopsRaw from '../../../contracts/fixtures/stops.json?raw'
import fxStatesRaw from '../../../contracts/fixtures/ws-state.jsonl?raw'
import type { Aoi, Conditions, RouteResponse, StopContent, WsServerMessage } from './types'

/** The real AOI (contracts-v1). */
export const aoi = JSON.parse(aoiRaw) as Aoi

/** SYNTHETIC fixtures for DEMO mode and tests. */
export const fixtures = {
  aoi: JSON.parse(fxAoiRaw) as Aoi,
  conditions: JSON.parse(fxConditionsRaw) as Conditions,
  route: JSON.parse(fxRouteRaw) as RouteResponse,
  stops: JSON.parse(fxStopsRaw) as StopContent[],
  /** ws-state.jsonl: state frames one simulated minute apart, with event frames in between. */
  frames: fxStatesRaw
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l) as WsServerMessage),
}

// URL of every fixture asset, keyed by file name (e.g. "ortho_1m.jpg").
const fixtureAssetUrls: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../../contracts/fixtures/assets/*', { query: '?url', import: 'default', eager: true }),
  ).map(([path, url]) => [path.split('/').pop()!, url as string]),
)

/** URL of a fixture asset by file name, or undefined. */
export function fixtureAssetUrl(file: string): string | undefined {
  return fixtureAssetUrls[file]
}
