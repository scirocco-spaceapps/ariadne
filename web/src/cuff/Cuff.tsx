import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useMission } from '../app/store'
import { assetsUrl } from '../lib/config'
import type { Provenance } from '../lib/types'
import { fixtureSource, makeMarginAt, marginClass, remoteSource, useCostToHome } from '../map'
import { placeName } from '../panels/route'
import { StopCard } from '../stops'
import { AlertScreen } from './AlertScreen'
import { BearingArrow, MarginRing } from './Gauge'
import './cuff.css'
import {
  MARGIN_LABEL,
  bearingDeg,
  budgetLeft,
  compassPoint,
  costAt,
  marginColour,
  nextTarget,
  signedMin,
  walkDistance,
} from './cuffModel'
import { STATUS_LABEL, formatClock, statusTone } from './format'
import manifestUrl from './manifest.webmanifest?url&no-inline'
import { useCuffRoute } from './useCuffRoute'
import { useWakeLock } from './wakeLock'

function Prov({ p }: { p: Provenance }) {
  return (
    <span className="cuff-prov" title="Provenance">
      {p}
    </span>
  )
}

/** Adds the cuff's web app manifest and theme colour to <head> while the cuff is shown. */
function usePwaHead() {
  useEffect(() => {
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = manifestUrl
    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = '#000000'
    document.head.append(link, meta)
    return () => {
      link.remove()
      meta.remove()
    }
  }, [])
}

/** The wordmark: a thread drawn in code that ends in a loop (home), then the name. */
function Wordmark() {
  return (
    <span className="cuff-title cf-wordmark">
      <svg viewBox="0 0 32 20" width="30" height="19" aria-hidden="true" className="cf-wordmark-glyph">
        <path d="M2 16 C 8 2, 14 18, 20 8 S 27 4, 26 10" />
        <circle cx="27" cy="12" r="3.2" />
      </svg>
      Ariadne
    </span>
  )
}

const WAKE_TEXT = {
  off: 'Keep screen on',
  on: 'Screen stays on',
  unsupported: 'This browser cannot keep the screen on',
  refused: 'Screen lock refused: tap to try again',
} as const

/**
 * The astronaut's wrist display: margin to home, consumables, next stop, the stop card while
 * dwelling, and a full-screen storm alert. Joins the session named by ?s=<id>.
 */
export function Cuff() {
  const { search } = useLocation()
  const demo = useMission((s) => s.demo)
  const aoi = useMission((s) => s.aoi)
  const id = useMission((s) => s.session.id)
  const status = useMission((s) => s.session.status)
  const detail = useMission((s) => s.session.statusDetail)
  const state = useMission((s) => s.session.state)
  const route = useMission((s) => s.route)
  const budget = useMission((s) => s.budget)
  const routeError = useCuffRoute(search)
  const wake = useWakeLock()
  usePwaHead()

  // Same asset source as the console: SYNTHETIC fixtures in DEMO, the real AOI on the asset host.
  // Memoised: a new source object would make useCostToHome fetch the raster again.
  const source = useMemo(() => (demo || !aoi ? fixtureSource() : remoteSource(aoi, assetsUrl)), [demo, aoi])
  const cost = useCostToHome(source)
  const modelProv: Provenance = source.synthetic ? 'Simulation' : 'Modeled'

  const margin = state && cost && budget ? makeMarginAt(cost, budget)(state.pos[0], state.pos[1], state.t_min) : null
  const cls = marginClass(margin, budget ?? { budget_min: 0, reserve_min: 0 })
  const target = nextTarget(route, state)
  const fuel = state && budget ? budgetLeft(state.t_min, budget) : null
  const storm = state?.alert ? Math.max(0, state.alert.lead_min - (state.t_min - state.alert.since_t)) : null
  const returnMin = margin !== null && state && budget ? costAt(margin, state.t_min, budget) : null

  // Where the next target is, for the bearing arrow: the safe haven during an alert, else the stop.
  const targetXY = (() => {
    if (!state || !aoi || !target || target.here) return null
    if (target.kind === 'haven' || target.id === aoi.safe_haven.id) return aoi.safe_haven.xy
    return aoi.stops.find((s) => s.id === target.id)?.xy ?? null
  })()
  const bearing = targetXY && state ? bearingDeg(state.pos, targetXY) : null
  const homeBearing = state && aoi ? bearingDeg(state.pos, aoi.safe_haven.xy) : null
  const ringFrac = margin !== null && budget ? margin / Math.max(1, budget.budget_min - budget.reserve_min) : null
  const tone = margin === null ? 'none' : cls

  const marginWhy = !state
    ? 'Waiting for the first state.'
    : !cost
      ? 'Loading the cost-to-home map…'
      : 'No way home from here (outside the area or blocked).'

  if (!id && !demo) {
    return (
      <main className="cuff">
        <header className="cuff-top">
          <Wordmark />
          <span className={`cuff-pill cuff-pill--${statusTone(status)}`} data-testid="cuff-status" role="status">
            {STATUS_LABEL[status]}
          </span>
        </header>
        <section className="cuff-empty">
          <h1>No session</h1>
          <p>Scan the “Pair cuff” QR code on the mission console.</p>
        </section>
      </main>
    )
  }

  return (
    <main className={demo ? 'cuff cuff--demo' : 'cuff'}>
      <header className="cuff-top">
        {/* In DEMO the badge takes the title's slot, so switching to the fallback moves nothing. */}
        {demo ? (
          <span className="cuff-demo" title="SYNTHETIC fixtures, not real data">
            DEMO DATA
          </span>
        ) : (
          <Wordmark />
        )}
        <span className={`cuff-pill cuff-pill--${demo ? 'warn' : statusTone(status)}`} data-testid="cuff-status" role="status">
          {demo ? 'DEMO replay' : STATUS_LABEL[status]}
          {!demo && detail && status === 'rejected' && <>: {detail}</>}
        </span>
      </header>
      <h1 className="visually-hidden">Ariadne cuff</h1>

      <div className="cf-clockline">
        <span className="cf-clock" data-testid="cuff-clock" aria-label="Mission clock">
          {state ? formatClock(state.t_min) : 'T+ --:--:--'}
        </span>
        <span className="cf-run-wrap">
          <span className={`cf-beat${state?.running ? ' cf-beat--on' : ''}`} aria-hidden="true" />
          <span className="cuff-run">{state ? (state.running ? 'Running' : 'Paused') : 'Waiting'}</span>
        </span>
      </div>

      <section className={`cf-margin cf-tone--${tone}`} aria-label="Margin to home" data-testid="cuff-margin">
        <MarginRing frac={ringFrac} colour={margin === null ? 'var(--ink-3)' : marginColour(cls)}>
          <span className="cf-label">Margin to home</span>
          <span className="cf-margin-value" style={{ color: margin === null ? undefined : marginColour(cls) }}>
            {margin === null ? (
              '—'
            ) : (
              <>
                {signedMin(margin).replace(/ min$/, '')}
                <span className="cf-margin-unit"> min</span>
              </>
            )}
          </span>
        </MarginRing>
        <span className="cf-margin-class" style={{ color: margin === null ? undefined : marginColour(cls) }}>
          {margin === null ? marginWhy : MARGIN_LABEL[cls]} <Prov p={modelProv} />
        </span>
      </section>

      <section className="cf-block" aria-label="Consumables" data-testid="cuff-budget">
        <span className="cf-label">Consumables</span>
        {fuel ? (
          <>
            <div className="cf-bar" role="meter" aria-valuemin={0} aria-valuemax={1} aria-valuenow={fuel.frac}>
              <span
                className={`cf-bar-fill${fuel.left_min < fuel.reserve_min ? ' cf-bar-fill--low' : ''}`}
                style={{ width: `${fuel.frac * 100}%` }}
              />
              <span className="cf-bar-reserve" style={{ left: `${fuel.reserveFrac * 100}%` }} title="Reserve" />
            </div>
            <span className="cf-line">
              {Math.max(0, Math.round(fuel.left_min))} min left · reserve {fuel.reserve_min} <Prov p="Assumed" />
            </span>
          </>
        ) : (
          <span className="cf-line cf-dim">—</span>
        )}
      </section>

      <section className="cf-block cf-next" aria-label="Next stop" data-testid="cuff-next">
        <span className="cf-label">{state?.alert ? 'Heading to' : target?.here ? 'At' : 'Next stop'}</span>
        {target ? (
          <>
            <div className="cf-next-row">
              {bearing !== null && <BearingArrow deg={bearing} />}
              <span className="cf-next-name">{placeName(aoi, target.id)}</span>
            </div>
            {!target.here && (
              <span className="cf-line">
                {bearing !== null && (
                  <span className="cf-bearing-text">
                    {compassPoint(bearing)} {String(Math.round(bearing)).padStart(3, '0')}° ·{' '}
                  </span>
                )}
                {walkDistance(target.distance_m)}
                {target.eta_min !== null && <> · {Math.round(target.eta_min)} min</>} <Prov p={modelProv} />
              </span>
            )}
          </>
        ) : (
          <span className="cf-line cf-dim">
            {routeError ? `No route: ${routeError}` : state && route ? 'Home: the walk is done.' : 'Waiting for the route…'}
          </span>
        )}
      </section>

      {state?.at_stop && !state.alert && (
        <section className="cf-stop" aria-label="Stop card">
          <StopCard variant="cuff" id={state.at_stop} />
        </section>
      )}

      <section className="cf-foot">
        <dl className="cuff-pos">
          <dt>Position</dt>
          <dd data-testid="cuff-pos">
            {state ? (
              <>
                x {state.pos[0].toFixed(0)} m · y {state.pos[1].toFixed(0)} m
                <Prov p={state.provenance} />
              </>
            ) : (
              '—'
            )}
          </dd>
        </dl>
        <button type="button" className="cf-wake" onClick={wake.request} disabled={wake.state === 'on'}>
          {WAKE_TEXT[wake.state]}
        </button>
        {id && <p className="cuff-session">Session {id}</p>}
      </section>

      {storm !== null && (
        <AlertScreen
          timeToStorm={storm}
          lead={state?.alert?.lead_min ?? null}
          returnMin={returnMin}
          margin={margin}
          modelProv={modelProv}
          demo={demo}
          homeBearing={homeBearing}
          homeDistance={state?.alert && target ? target.distance_m : null}
        />
      )}
    </main>
  )
}
