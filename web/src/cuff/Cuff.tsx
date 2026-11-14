import { useMission } from '../app/store'
import './cuff.css'
import { STATUS_LABEL, formatClock, statusTone } from './format'

/**
 * The astronaut's wrist display (skeleton, N3): connection status, the mission clock and the raw
 * position from the WebSocket state. Joins the session named by ?s=<id> (see useSessionSocket).
 */
export function Cuff() {
  const demo = useMission((s) => s.demo)
  const id = useMission((s) => s.session.id)
  const status = useMission((s) => s.session.status)
  const detail = useMission((s) => s.session.statusDetail)
  const state = useMission((s) => s.session.state)

  return (
    <main className="cuff">
      <header className="cuff-top">
        <span className="cuff-title">Ariadne</span>
        <span className={`cuff-pill cuff-pill--${statusTone(status)}`} data-testid="cuff-status" role="status">
          {STATUS_LABEL[status]}
          {detail && status === 'rejected' && <>: {detail}</>}
        </span>
      </header>

      {!id && !demo ? (
        <section className="cuff-empty">
          <h1>No session</h1>
          <p>Scan the “Pair cuff” QR code on the mission console.</p>
        </section>
      ) : (
        <section className="cuff-body">
          <h1 className="visually-hidden">Ariadne cuff</h1>
          <div className="cuff-clock" data-testid="cuff-clock" aria-label="Mission clock">
            {state ? formatClock(state.t_min) : 'T+ --:--:--'}
          </div>
          <div className="cuff-run">{state ? (state.running ? 'Running' : 'Paused') : 'Waiting for state'}</div>

          <dl className="cuff-pos">
            <dt>Position</dt>
            <dd data-testid="cuff-pos">
              {state ? (
                <>
                  x {state.pos[0].toFixed(0)} m · y {state.pos[1].toFixed(0)} m
                  <span className="cuff-prov" title="Provenance">
                    {state.provenance}
                  </span>
                </>
              ) : (
                '—'
              )}
            </dd>
          </dl>
          {id && <p className="cuff-session">Session {id}</p>}
        </section>
      )}
    </main>
  )
}
