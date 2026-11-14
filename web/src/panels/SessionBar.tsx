import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMission } from '../app/store'
import { ApiError, missionControl } from '../lib/api'
import { aoi, fixtures } from '../lib/fixtures'
import { PairCuff } from './PairCuff'
import { cuffUrl } from './pairing'
import { ProvBadge } from './ProvBadge'
import {
  DEFAULT_LEAD,
  DEFAULT_SPEED,
  LEAD_TIMES,
  SPEEDS,
  evaClock,
  minSec,
  sessionBody,
  shortcutFor,
  timeToStorm,
  type Shortcut,
} from './session'
import './console.css'

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.detail : 'mission-control is unreachable'
}

/**
 * Bottom bar of the console: one person runs the whole demo from here. Create a session from the
 * current route, start / pause / reset, speed, seek, storm alert and clear, pair the cuff.
 * Keyboard: S start/pause, A alert, C clear.
 */
export function SessionBar() {
  const demo = useMission((s) => s.demo)
  const id = useMission((s) => s.session.id)
  const state = useMission((s) => s.session.state)
  const route = useMission((s) => s.route)
  const budget = useMission((s) => s.budget)
  const [, setParams] = useSearchParams()

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pairing, setPairing] = useState(false)
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED)
  const [lead, setLead] = useState<number>(DEFAULT_LEAD)
  const [drag, setDrag] = useState<number | null>(null)

  const running = state?.running ?? false
  const live = !demo && id !== null
  const end = Math.max((route ?? fixtures.route).totals.eva_min, 1)
  const t = drag ?? state?.t_min ?? 0
  const storm = timeToStorm(state)

  const run = async (fn: (sid: string) => Promise<unknown>) => {
    if (!id || demo) return
    setBusy(true)
    setError(null)
    try {
      await fn(id)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      const { id: newId } = await missionControl.createSession(sessionBody(route ?? fixtures.route, budget, aoi))
      useMission.getState().setSessionId(newId)
      // Keep the id in the URL so a reload rejoins the same session.
      setParams(
        (p) => {
          p.set('s', newId)
          return p
        },
        { replace: true },
      )
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const startPause = () => run((sid) => missionControl.control(sid, running ? { action: 'pause' } : { action: 'start', speed }))
  const reset = () => run((sid) => missionControl.control(sid, { action: 'reset' }))
  const seek = (t_min: number) => run((sid) => missionControl.control(sid, { action: 'seek', t_min }))
  const alert = () => run((sid) => missionControl.event(sid, { type: 'storm_alert', lead_min: lead }))
  const clear = () => run((sid) => missionControl.event(sid, { type: 'clear' }))

  const changeSpeed = (v: number) => {
    setSpeed(v)
    // While running, re-sending start applies the new speed (the contract has no separate speed call).
    if (running) void run((sid) => missionControl.control(sid, { action: 'start', speed: v }))
  }

  const commitSeek = () => {
    if (drag === null) return
    const v = drag
    setDrag(null)
    void seek(v)
  }

  // Keyboard shortcuts; the latest handlers live in a ref so the listener is added once.
  const canAct = live && !busy
  const actions = useRef<Record<Shortcut, () => void>>({ start: () => {}, alert: () => {}, clear: () => {} })
  const canActRef = useRef(canAct)
  useEffect(() => {
    actions.current = { start: () => void startPause(), alert: () => void alert(), clear: () => void clear() }
    canActRef.current = canAct
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = shortcutFor(e)
      if (!s || !canActRef.current) return
      e.preventDefault()
      actions.current[s]()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const url = cuffUrl(location.origin, id, demo)

  return (
    <footer className="cx-bar" aria-label="Session controls">
      <div className="cx-bar-row">
        <div className="cx-group">
          <button type="button" onClick={create} disabled={demo || busy}>
            {id && !demo ? 'New session' : 'Create session'}
          </button>
        </div>

        <div className="cx-group">
          <button type="button" className="cx-primary" onClick={startPause} disabled={!canAct} aria-keyshortcuts="S">
            {running ? 'Pause' : 'Start'} <kbd>S</kbd>
          </button>
          <button type="button" onClick={reset} disabled={!canAct}>
            Reset
          </button>
          <label className="cx-field">
            Speed
            <select value={speed} onChange={(e) => changeSpeed(Number(e.currentTarget.value))} disabled={demo}>
              {SPEEDS.map((v) => (
                <option key={v} value={v}>
                  {v} min/s
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="cx-group cx-scrub">
          <span className="cx-clock" data-testid="bar-clock">
            {evaClock(t)}
          </span>
          <input
            type="range"
            aria-label="Session clock (seek)"
            min={0}
            max={end}
            step={0.5}
            value={Math.min(t, end)}
            disabled={!canAct || !state}
            onChange={(e) => setDrag(Number(e.currentTarget.value))}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
            onBlur={commitSeek}
          />
          <span className="cx-clock cx-dim">{evaClock(end)}</span>
          <ProvBadge p="Simulation" />
        </div>

        <div className="cx-group">
          <label className="cx-field">
            Lead
            <select
              value={lead}
              onChange={(e) => setLead(Number(e.currentTarget.value))}
              disabled={demo}
              title="Minutes until the storm arrives (scenario input)"
            >
              {LEAD_TIMES.map((v) => (
                <option key={v} value={v}>
                  {v} min
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="cx-alert" onClick={alert} disabled={!canAct} aria-keyshortcuts="A">
            Storm alert <kbd>A</kbd>
          </button>
          <button type="button" onClick={clear} disabled={!canAct || !state?.alert} aria-keyshortcuts="C">
            Clear <kbd>C</kbd>
          </button>
        </div>

        <div className="cx-group cx-right-group">
          <button type="button" onClick={() => setPairing(true)} disabled={!url}>
            Pair cuff
          </button>
        </div>
      </div>

      <div className="cx-bar-status">
        {storm !== null ? (
          <p className="cx-storm" role="alert" data-testid="storm-strip">
            STORM ALERT · time to storm {minSec(storm)} · following the thread home
          </p>
        ) : error ? (
          <p className="cx-error" role="alert" title={error}>
            {error}
          </p>
        ) : (
          <p className="cx-hint">
            {demo
              ? 'DEMO replay: session controls need mission-control.'
              : id
                ? 'S start / pause · A storm alert · C clear'
                : 'Plan a route, then create a session.'}
            {!demo && route === null && <span className="cx-tag cx-tag-warn">Route: SYNTHETIC fixture</span>}
          </p>
        )}
      </div>

      {pairing && url && <PairCuff url={url} demo={demo} onClose={() => setPairing(false)} />}
    </footer>
  )
}
