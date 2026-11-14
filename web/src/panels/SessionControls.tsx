import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMission } from '../app/store'
import { ApiError, missionControl } from '../lib/api'
import { aoi, fixtures } from '../lib/fixtures'
import { PairCuff } from './PairCuff'
import { cuffUrl } from './pairing'
import './panels.css'

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.detail
  return 'mission-control is unreachable'
}

/**
 * Minimal session controls for N3: create a session from the route in the store, start or pause
 * it, and pair a cuff by QR. The full session bar comes with the N6 console layout.
 */
export function SessionControls() {
  const demo = useMission((s) => s.demo)
  const id = useMission((s) => s.session.id)
  const running = useMission((s) => s.session.state?.running ?? false)
  const route = useMission((s) => s.route)
  const budget = useMission((s) => s.budget)
  const [, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)

  // Until the planner is wired in (N5) the store has no route: fall back to the SYNTHETIC fixture.
  const usingFixtureRoute = route === null

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const create = () =>
    run(async () => {
      const b = budget ?? { budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min }
      const { id: newId } = await missionControl.createSession({
        route: route ?? fixtures.route,
        budget_min: b.budget_min,
        reserve_min: b.reserve_min,
        dwell_min: aoi.model.dwell_min,
      })
      useMission.getState().setSessionId(newId)
      // Keep the id in the URL so a reload rejoins the same session.
      setParams((p) => {
        p.set('s', newId)
        return p
      }, { replace: true })
    })

  const toggle = () =>
    run(async () => {
      if (!id) return
      await missionControl.control(id, { action: running ? 'pause' : 'start' })
    })

  const url = cuffUrl(location.origin, id, demo)

  return (
    <div className="session-controls">
      {!demo && (
        <>
          <button type="button" onClick={create} disabled={busy}>
            {id ? 'New session' : 'Create session'}
          </button>
          <button type="button" onClick={toggle} disabled={busy || !id}>
            {running ? 'Pause' : 'Start'}
          </button>
        </>
      )}
      <button type="button" onClick={() => setPairing(true)} disabled={!url}>
        Pair cuff
      </button>
      {!demo && usingFixtureRoute && <span className="session-note">Route: SYNTHETIC fixture</span>}
      {error && (
        <span className="session-error" role="alert">
          {error}
        </span>
      )}
      {pairing && url && <PairCuff url={url} demo={demo} onClose={() => setPairing(false)} />}
    </div>
  )
}
