import { useMemo } from 'react'
import { useMission } from '../app/store'
import { bearingDeg, compassPoint, marginColour, nextTarget, walkDistance, MARGIN_LABEL } from '../cuff/cuffModel'
import type { Provenance } from '../lib/types'
import { makeMarginAt, marginClass, useCostToHome, type AssetSource } from '../map'
import { ProvBadge } from './ProvBadge'
import { placeName } from './route'

/** Simulated minutes as h:mm:ss. */
function hms(tMin: number): string {
  const total = Math.max(0, Math.round(tMin * 60))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}

/**
 * The console's headline instrument, centred over the map: mission clock, margin to home (the one
 * number Ariadne exists for) and where the astronaut walks next. Same maths as the cuff.
 */
export function MissionHud({ source }: { source: AssetSource }) {
  const state = useMission((s) => s.session.state)
  const route = useMission((s) => s.route)
  const aoi = useMission((s) => s.aoi)
  const budget = useMission((s) => s.budget)
  const cost = useCostToHome(source)
  const prov: Provenance = source.synthetic ? 'Simulation' : 'Modeled'

  const margin = useMemo(
    () => (state && cost && budget ? makeMarginAt(cost, budget)(state.pos[0], state.pos[1], state.t_min) : null),
    [state, cost, budget],
  )
  const cls = marginClass(margin, budget ?? { budget_min: 0, reserve_min: 0 })
  const colour = margin === null ? undefined : marginColour(cls)
  const target = nextTarget(route, state)
  const targetXY =
    state && aoi && target && !target.here
      ? target.kind === 'haven' || target.id === aoi.safe_haven.id
        ? aoi.safe_haven.xy
        : aoi.stops.find((s) => s.id === target.id)?.xy ?? null
      : null
  const bearing = targetXY && state ? bearingDeg(state.pos, targetXY) : null
  const frac = margin !== null && budget ? Math.min(1, Math.max(0, margin / Math.max(1, budget.budget_min - budget.reserve_min))) : 0

  return (
    <section className={`hud hud--${margin === null ? 'none' : cls}`} aria-label="Mission status">
      <div className="hud-tile hud-clock">
        <span className="hud-k">Mission clock</span>
        <span className="hud-v hud-mono">T+ {state ? hms(state.t_min) : '–:––:––'}</span>
        <span className="hud-sub">
          {state ? (state.running ? 'Walking' : 'Paused') : 'No session'} <ProvBadge p="Simulation" />
        </span>
      </div>

      <div className="hud-tile hud-margin">
        <span className="hud-k">Margin to home</span>
        <span className="hud-v hud-big" style={{ color: colour }}>
          {margin === null ? '—' : `${margin >= 0 ? '+' : '−'}${Math.abs(Math.round(margin))}`}
          <span className="hud-unit">min</span>
        </span>
        <span className="hud-meter" aria-hidden="true">
          <span style={{ transform: `scaleX(${frac})`, background: colour }} />
        </span>
        <span className="hud-sub" style={{ color: colour }}>
          {margin === null ? 'Waiting for the walk' : MARGIN_LABEL[cls]} <ProvBadge p={prov} />
        </span>
      </div>

      <div className="hud-tile hud-next">
        <span className="hud-k">{state?.alert ? 'Heading home' : target?.here ? 'At stop' : 'Next stop'}</span>
        <span className="hud-v hud-name">{target ? placeName(aoi, target.id) : '—'}</span>
        <span className="hud-sub">
          {target && !target.here ? (
            <>
              {bearing !== null && (
                <span className="hud-bearing">
                  <span className="hud-arrow" style={{ transform: `rotate(${bearing}deg)` }} aria-hidden="true">
                    ▲
                  </span>
                  {compassPoint(bearing)}
                </span>
              )}
              {walkDistance(target.distance_m)}
              {target.eta_min !== null && <> · {Math.round(target.eta_min)} min</>}
            </>
          ) : target?.here ? (
            target.kind === 'haven' || target.id === aoi?.safe_haven.id ? 'Home: inside the rover' : 'Dwelling: science tasks on the cuff'
          ) : (
            'Plan a route to start'
          )}{' '}
          <ProvBadge p={source.synthetic ? 'Simulation' : 'Modeled'} />
        </span>
      </div>
    </section>
  )
}
