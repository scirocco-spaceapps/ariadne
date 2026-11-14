import { FIXTURE_LABEL, fixtureStops } from './loader'
import { StopCard } from './StopCard'
import './stops.css'

/** Development page for /dev/stops: every fixture stop in both variants, plus loader errors. */
export function DevStopsPage() {
  const { stops, errors } = fixtureStops()
  const ids = Object.keys(stops)
  return (
    <main className="stop-dev">
      <h1>Stop cards (dev)</h1>
      <p>
        {ids.length} entries from <code>{FIXTURE_LABEL}</code> (SYNTHETIC). Left: console side panel. Right: cuff at
        360 px.
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
