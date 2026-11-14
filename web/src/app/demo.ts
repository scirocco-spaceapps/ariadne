// DEMO mode: replays contracts/fixtures/ws-state.jsonl into the store at the live broadcast rate,
// so console and cuff work without any service. All of it is SYNTHETIC.
import { fixtures } from '../lib/fixtures'
import type { WsServerMessage } from '../lib/types'
import { useMission } from './store'

export const DEMO_TICK_MS = 500
const LOOP_PAUSE_TICKS = 6

/** Groups the fixture stream into ticks: the events before a state, then that state. */
function ticks(frames: WsServerMessage[]): WsServerMessage[][] {
  const out: WsServerMessage[][] = []
  let cur: WsServerMessage[] = []
  for (const f of frames) {
    cur.push(f)
    if (f.type === 'state') {
      out.push(cur)
      cur = []
    }
  }
  return out
}

/** Loads the fixtures into the store and starts the replay, looping. Returns a stop function. */
export function startDemo(): () => void {
  const store = useMission.getState()
  const { aoi, route, conditions, frames } = fixtures
  const groups = ticks(frames)
  const first = groups[0].find((f) => f.type === 'state')
  store.setDemo(true)
  store.setAoi(aoi)
  store.setRoute(route)
  store.setBudget({ budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min })
  store.setConditions(conditions)
  store.setSessionId(first && first.type === 'state' ? first.session : 'demo')
  store.setSessionStatus('open')

  let i = 0
  const step = () => {
    const idx = i++ % (groups.length + LOOP_PAUSE_TICKS)
    if (idx >= groups.length) return // hold the last frame for a moment before looping
    for (const f of groups[idx]) useMission.getState().receive(f)
  }
  step()
  const timer = setInterval(step, DEMO_TICK_MS)
  return () => clearInterval(timer)
}
