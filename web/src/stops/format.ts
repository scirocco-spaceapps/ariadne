import { assetsUrl } from '../lib/config'
import type { StopContent } from '../lib/types'

/**
 * URL of a stop photo. `photos[].file` is relative to content/ (contracts/openapi.yaml `Photo`).
 * How content photos are hosted is not in the contract yet; they are expected next to the assets
 * on the asset host, under content/. Change it here only.
 */
export function photoUrl(file: string): string {
  return `${assetsUrl}content/${file}`
}

/** Metres for display: one decimal below 10 m, whole metres above. */
export function formatDistance(m: number): string {
  return m < 10 ? m.toFixed(1) : Math.round(m).toString()
}

/**
 * "Seen from <distance> m on sol <n>, never visited" for a target, from its first photo
 * (docs/PLAN_CHANGES.md, F2). Null for a stop or a target without photos.
 */
export function targetLine(content: Pick<StopContent, 'kind' | 'photos'>): string | null {
  if (content.kind !== 'target') return null
  const p = content.photos[0]
  if (!p) return null
  return p.distance_m === undefined
    ? `Seen on sol ${p.sol}, never visited`
    : `Seen from ${formatDistance(p.distance_m)} m on sol ${p.sol}, never visited`
}
