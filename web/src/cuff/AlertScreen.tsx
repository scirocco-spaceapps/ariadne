import type { Provenance } from '../lib/types'
import { minSec, signedMin } from './cuffModel'

interface AlertScreenProps {
  /** Minutes until the storm arrives (Simulation). */
  timeToStorm: number
  /** Minutes to walk home from here (Modeled from cost_to_home), or null when unknown. */
  returnMin: number | null
  /** Margin to home in minutes, or null when unknown. */
  margin: number | null
  /** Provenance of the cost-to-home numbers. */
  modelProv: Provenance
}

function Prov({ p }: { p: Provenance }) {
  return <span className="cf-prov">{p}</span>
}

/** Full-screen storm alert: the one thing the astronaut must read and act on. */
export function AlertScreen({ timeToStorm, returnMin, margin, modelProv }: AlertScreenProps) {
  return (
    <section className="cf-alert" role="alert" aria-live="assertive" data-testid="cuff-alert">
      <p className="cf-alert-title">STORM ALERT</p>
      <p className="cf-alert-sub">Follow the thread home</p>
      <dl className="cf-alert-grid">
        <div>
          <dt>Time to storm</dt>
          <dd data-testid="alert-storm">
            {minSec(timeToStorm)} <Prov p="Simulation" />
          </dd>
        </div>
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
    </section>
  )
}
