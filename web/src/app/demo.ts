// DEMO mode: replays contracts/fixtures/ws-state.jsonl into the store at the live broadcast rate,
// so console and cuff work without any service. All of it is SYNTHETIC.
import { fixtures } from '../lib/fixtures'
import type { WsServerMessage } from '../lib/types'
import { useMission } from './store'

export const DEMO_TICK_MS = 500
const LOOP_PAUSE_TICKS = 6

/** Groups the fixture stream into ticks: the events before a state, then that state. */
export function ticks(frames: WsServerMessage[]): WsServerMessage[][] {
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

/**
 * The ticks before the first storm alert (an alert event or a state carrying an alert). The
 * fallback replays only these, so a dropped link never shows a storm nobody triggered.
 */
export function calmTicks(groups: WsServerMessage[][]): WsServerMessage[][] {
  const stormy = (f: WsServerMessage) =>
    (f.type === 'event' && f.name === 'storm_alert') || (f.type === 'state' && f.alert !== null)
  const end = groups.findIndex((g) => g.some(stormy))
  return end < 0 ? groups : groups.slice(0, end)
}

/**
 * Replay position at wall-clock time `nowMs`, in ticks. Locked to the clock, not to page load, so a
 * console and a paired cuff opened at different times show the same frame. Indexes past the last
 * group are the pause before the loop restarts.
 */
export function demoIndex(nowMs: number, nGroups: number): number {
  return Math.floor(nowMs / DEMO_TICK_MS) % (nGroups + LOOP_PAUSE_TICKS)
}

/**
 * Loads the fixtures into the store and starts the replay, looping. Returns a stop function.
 * `calm: true` (the fallback when mission-control is unreachable) loops only the part before the
 * fixture's storm alert; DEMO mode (`?demo=1`) plays the whole scenario, alert included.
 */
export function startDemo(opts: { calm?: boolean } = {}): () => void {
  const store = useMission.getState()
  const { aoi, route, conditions, frames } = fixtures
  const all = ticks(frames)
  const groups = opts.calm ? calmTicks(all) : all
  const first = groups[0].find((f) => f.type === 'state')
  store.setDemo(true)
  store.setAoi(aoi)
  store.setRoute(route)
  store.setBudget({ budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min })
  store.setConditions(conditions)
  store.setSessionId(first && first.type === 'state' ? first.session : 'demo')
  store.setSessionStatus('open')

  let last = -1
  const step = () => {
    const idx = demoIndex(Date.now(), groups.length)
    if (idx === last) return
    last = idx
    if (idx >= groups.length) return // hold the last frame for a moment before looping
    for (const f of groups[idx]) useMission.getState().receive(f)
  }
  step()
  // Poll faster than a tick so a frame lands close to its wall-clock boundary on every screen.
  const timer = setInterval(step, DEMO_TICK_MS / 5)
  return () => clearInterval(timer)
}
