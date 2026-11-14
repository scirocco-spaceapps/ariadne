// Time bar under the map (Y4). Planning mode (a route, no session): drag to move the astronaut along
// the plan; bound to usePlanClock. With a session the bar follows the simulated clock, read-only.

import type { Provenance, RouteResponse, WsState } from '../lib/types'
import { usePlanClock } from './planClock'
import { arrivalTicks, evaClockLabel } from './route'

type Props = { route: RouteResponse; state: WsState | null; provenance: Provenance }

export function TimeBar({ route, state, provenance }: Props) {
  const planT = usePlanClock((s) => s.t_min)
  const setT = usePlanClock((s) => s.setT)
  const end = Math.max(route.totals.eva_min, 0.5)
  const live = state !== null
  const t = live ? state.t_min : Math.min(planT, end)
  const ticks = arrivalTicks(route)
  const prov: Provenance = live ? 'Simulation' : provenance

  return (
    <div className="am-timebar" data-testid="time-bar">
      <div className="am-timebar-head">
        <span>{live ? 'Session clock' : 'Plan time'}</span>
        <span className="am-timebar-clock" data-testid="time-bar-clock">
          {evaClockLabel(t)}
        </span>
        <span className={`am-prov am-prov-${prov.toLowerCase()}`}>{prov}</span>
        <span className="am-timebar-end">of {evaClockLabel(route.totals.eva_min)}</span>
      </div>
      <div className="am-timebar-track">
        <input
          type="range"
          aria-label={live ? 'Session clock (follows the simulation)' : 'Plan time'}
          min={0}
          max={end}
          step={0.5}
          value={Math.min(t, end)}
          disabled={live}
          onChange={(e) => setT(Number(e.currentTarget.value))}
        />
        <ol className="am-timebar-ticks" aria-label="Arrivals">
          {ticks.map((k, i) => (
            <li
              key={`${k.stop}-${i}`}
              style={{ left: `${(Math.min(k.t_min, end) / end) * 100}%` }}
              title={`${k.n !== null ? `Stop ${k.n}` : 'Safe haven'} at ${evaClockLabel(k.t_min)}`}
            >
              {k.n ?? 'H'}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
