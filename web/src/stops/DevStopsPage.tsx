import { FIXTURE_LABEL, useStopSet } from './loader'
import { StopCard } from './StopCard'
import './stops.css'

/** Development page for /dev/stops: every stop of the current mode in both variants, plus loader
 *  errors. Live: content/stops/*.json. DEMO (?demo=1): the SYNTHETIC fixtures. */
export function DevStopsPage() {
  const { set, synthetic, loading } = useStopSet()
  const { stops, errors } = set
  const ids = Object.keys(stops).sort()
  const label = synthetic ? `${FIXTURE_LABEL} (SYNTHETIC)` : 'content/stops/*.json'
  return (
    <main className="stop-dev">
      <h1>Stop cards (dev)</h1>
      <p>
        {loading ? 'Loading ' : `${ids.length} entries from `}
        <code>{label}</code>. Left: console side panel. Right: cuff at 360 px.
      </p>
      {errors.length > 0 && (
        <ul className="stop-errors" data-testid="dev-stop-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {ids.map((id) => (
        <section key={id} className="stop-dev-row" aria-label={`Stop ${id}`}>
          <div className="stop-dev-col">
            <span>console · {id}</span>
            <StopCard variant="console" id={id} />
          </div>
          <div className="stop-dev-col">
            <span>cuff · {id}</span>
            <div className="stop-dev-cuff">
              <StopCard variant="cuff" id={id} />
            </div>
          </div>
        </section>
      ))}
    </main>
  )
}
