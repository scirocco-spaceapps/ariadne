import { useEffect } from 'react'
import type { Provenance } from '../lib/types'
import { compassPoint, minSec, signedMin, walkDistance } from './cuffModel'
import { BearingArrow } from './Gauge'

interface AlertScreenProps {
  /** Minutes until the storm arrives (Simulation). */
  timeToStorm: number
  /** Lead time the alert was raised with (Simulation), for the countdown ring; null if unknown. */
  lead?: number | null
  /** Minutes to walk home from here (Modeled from cost_to_home), or null when unknown. */
  returnMin: number | null
  /** Margin to home in minutes, or null when unknown. */
  margin: number | null
  /** Provenance of the cost-to-home numbers. */
  modelProv: Provenance
  /** SYNTHETIC replay (DEMO mode or the fallback): the alert must still say so. */
  demo?: boolean
  /** Bearing to the safe haven, degrees from north (Simulation position); null if unknown. */
  homeBearing?: number | null
  /** Metres left along the way home (Simulation); null if unknown. */
  homeDistance?: number | null
}

function Prov({ p }: { p: Provenance }) {
  return <span className="cf-prov">{p}</span>
}

/** Full-screen storm alert: the one thing the astronaut must read and act on. */
export function AlertScreen({
  timeToStorm,
  lead = null,
  returnMin,
  margin,
  modelProv,
  demo = false,
  homeBearing = null,
  homeDistance = null,
}: AlertScreenProps) {
  // A wrist display buzzes once when the alert lands (no-op where vibration is unsupported).
  useEffect(() => {
    try {
      navigator.vibrate?.([220, 90, 220, 90, 420])
    } catch {
      // ignore
    }
  }, [])

  const frac = lead && lead > 0 ? Math.min(1, Math.max(0, timeToStorm / lead)) : null
  const beats = returnMin !== null && returnMin < timeToStorm

  return (
    <section className="cf-alert" role="alert" aria-live="assertive" data-testid="cuff-alert">
      <div className="cf-alert-hazard" aria-hidden="true" />
      <div className="cf-alert-glow" aria-hidden="true" />
      {demo && (
        <span className="cuff-demo cf-alert-demo" title="SYNTHETIC fixtures, not real data">
          DEMO DATA
        </span>
      )}
      <div className="cf-alert-body">
        <p className="cf-alert-title">STORM ALERT</p>
        <p className="cf-alert-sub">Follow the thread home</p>

        <div className="cf-alert-count">
          <span className="cf-alert-k">Time to storm</span>
          <span className="cf-alert-countdown" data-testid="alert-storm">
            {minSec(timeToStorm)} <Prov p="Simulation" />
          </span>
          {frac !== null && (
            <span className="cf-alert-meter" aria-hidden="true">
              <span style={{ transform: `scaleX(${frac})` }} />
            </span>
          )}
        </div>

        <dl className="cf-alert-grid">
          <div>
            <dt>Walk home</dt>
            <dd data-testid="alert-return">
              {returnMin === null ? '—' : `${Math.round(returnMin)} min`} <Prov p={modelProv} />
            </dd>
          </div>
          <div>
            <dt>Margin</dt>
            <dd data-testid="alert-margin">
              {margin === null ? '—' : signedMin(margin)} <Prov p={modelProv} />
            </dd>
          </div>
        </dl>

        {homeDistance !== null && homeDistance < 5 ? (
          <div className="cf-alert-home">
            <span>
              <strong>Home: inside the rover</strong>
              <br />
              <span className="cf-alert-verdict">Safe before the storm.</span> <Prov p="Simulation" />
            </span>
          </div>
        ) : homeBearing !== null && (
          <div className="cf-alert-home">
            <BearingArrow deg={homeBearing} size={64} />
            <span>
              <strong>
                Home {compassPoint(homeBearing)} {String(Math.round(homeBearing)).padStart(3, '0')}°
              </strong>
              {homeDistance !== null && <> · {walkDistance(homeDistance)} along the thread</>}
              <br />
              <span className="cf-alert-verdict">
                {returnMin === null ? 'Keep walking the thread.' : beats ? 'You beat the storm home.' : 'Move now: the storm is close.'}
              </span>{' '}
              <Prov p="Simulation" />
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
