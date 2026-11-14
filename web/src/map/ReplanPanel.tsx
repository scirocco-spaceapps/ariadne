// MPC-2: the replanning suggestion on the console map, with the two what-if controls. A suggestion
// only: the crew decides, and the simulated astronaut does not follow it.

import type { Aoi } from '../lib/types'
import { REPLAN_CONTROLS, suggestionText } from './replan'
import { useReplanControls, type Replan } from './useReplan'

export function ReplanPanel({ replan, aoi }: { replan: Replan; aoi: Aoi }) {
  const c = useReplanControls()
  if (!replan.active) return null
  const { result } = replan
  const low = result !== null && result.reserve_left_min < replan.reserve_min
  return (
    <section className="am-replan" aria-label="Replanning" data-testid="replan-panel">
      <header className="am-replan-head">
        <span>Replanning, what if</span>
        <span className="am-prov am-prov-simulation">Simulation</span>
      </header>
      <label className="am-replan-row">
        <input type="checkbox" checked={c.leakOn} onChange={(e) => c.set({ leakOn: e.target.checked })} />
        <span>Suit leak</span>
        <input
          type="range"
          aria-label="Suit leak, minutes of consumables lost"
          min={REPLAN_CONTROLS.leak_min.min}
          max={REPLAN_CONTROLS.leak_min.max}
          step={REPLAN_CONTROLS.leak_min.step}
          value={c.leak_min}
          disabled={!c.leakOn}
          onChange={(e) => c.set({ leak_min: Number(e.target.value) })}
        />
        <span className="am-replan-val">−{c.leak_min} min</span>
      </label>
      <label className="am-replan-row">
        <input type="checkbox" checked={c.dustOn} onChange={(e) => c.set({ dustOn: e.target.checked })} />
        <span>Dust / low visibility</span>
        <input
          type="range"
          aria-label="Dust, walking speed factor"
          min={REPLAN_CONTROLS.speed_factor.min}
          max={REPLAN_CONTROLS.speed_factor.max}
          step={REPLAN_CONTROLS.speed_factor.step}
          value={c.speed_factor}
          disabled={!c.dustOn}
          onChange={(e) => c.set({ speed_factor: Number(e.target.value) })}
        />
        <span className="am-replan-val">×{c.speed_factor.toFixed(1)} speed</span>
      </label>
      <div className="am-replan-out" data-testid="replan-suggestion" role="status">
        {replan.storm && <strong className="am-replan-action am-replan-go_home_now">Storm alert: following the way home, no replan.</strong>}
        {!replan.storm && replan.table === 'loading' && 'Loading leg times from the planner…'}
        {!replan.storm && replan.table === 'error' && 'Replanning unavailable: the planner did not answer.'}
        {!replan.storm && replan.table === 'ready' && !result && 'Nothing to replan: no stop left on the plan.'}
        {!replan.storm && result && (
          <>
            <strong className={`am-replan-action am-replan-${result.action}`}>{suggestionText(result, aoi)}</strong>
            <span className={low ? 'am-replan-low' : undefined}>
              Home with {Math.round(result.reserve_left_min)} min reserve{' '}
              <span className="am-prov am-prov-modeled">Modeled</span>
            </span>
          </>
        )}
      </div>
    </section>
  )
}
