import type { Provenance } from '../lib/types'
import type { ElevPoint } from './elevation'
import { ProvBadge } from './ProvBadge'

const W = 340
const H = 80
const PAD = 4

/** Small elevation-over-EVA-time line. Same box in every state, so nothing shifts. */
export function ElevationLine({
  points,
  provenance,
  message,
}: {
  points: ElevPoint[] | null
  provenance: Provenance
  message?: string
}) {
  const ok = points !== null && points.length >= 2
  let d = ''
  let zMin = 0
  let zMax = 0
  let tMax = 0
  if (ok) {
    zMin = Math.min(...points.map((p) => p.z))
    zMax = Math.max(...points.map((p) => p.z))
    tMax = Math.max(...points.map((p) => p.t)) || 1
    const zSpan = zMax - zMin || 1
    d = points
      .map((p, i) => {
        const x = PAD + (p.t / tMax) * (W - 2 * PAD)
        const y = H - PAD - ((p.z - zMin) / zSpan) * (H - 2 * PAD)
        return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
      })
      .join('')
  }

  return (
    <figure className="pn-elev" data-testid="elevation-line">
      <figcaption>
        Elevation over EVA time <ProvBadge p={provenance} />
      </figcaption>
      <div className="pn-elev-box">
        {ok ? (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Elevation over EVA time">
              <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            </svg>
            <span className="pn-elev-max">{zMax.toFixed(0)} m</span>
            <span className="pn-elev-min">{zMin.toFixed(0)} m</span>
            <span className="pn-elev-t">T+ {Math.round(tMax)} min</span>
          </>
        ) : (
          <p className="pn-placeholder">{message ?? 'Elevation unavailable (DEM not loaded).'}</p>
        )}
      </div>
    </figure>
  )
}
