// Link health between this page and mission-control (N7): when the link is down the banner says
// so; after 10 s the screen falls back to the DEMO replay (SYNTHETIC, with the badge) while the
// socket keeps reconnecting; the first live frame brings the live session back. If mission-control
// restarted and lost the session (close 4404), the console recreates it where it was.
import { create } from 'zustand'
import { missionControl } from '../lib/api'
import { aoi as realAoi } from '../lib/fixtures'
import type { SocketStatus } from '../lib/socket'
import type { Conditions, RouteResponse, WsServerMessage, WsState } from '../lib/types'
import type { Role } from '../lib/config'
import { evaClock, sessionBody, timeToStorm } from '../panels/session'
import { startDemo } from './demo'
import { useMission, type Budget, type MissionSession } from './store'

/** Down this long → DEMO fallback. */
export const FALLBACK_AFTER_MS = 10_000
/** A running session broadcasts at 2 Hz; this long without a frame means the link is dead. */
export const STALE_MS = 3_000
/**
 * A paused session sends no frames, so while the socket is open /health is asked this often; no
 * answer within HEALTH_TIMEOUT_MS means the link is dead (a frozen server or a silent drop).
 */
export const HEALTH_EVERY_MS = 5_000
export const HEALTH_TIMEOUT_MS = 4_000
/** Show "can't reach" on first connect only after this, so a normal page load does not flash it. */
export const FIRST_CONNECT_GRACE_MS = 2_000
export const RECREATE_RETRY_MS = 2_000
export const RECREATE_GIVE_UP_MS = 60_000
export const RECONNECTED_SHOW_MS = 3_000
export const RESTORED_SHOW_MS = 30_000

export type LinkNotice =
  | { kind: 'reconnected'; at: number }
  | { kind: 'restored'; at: number; t_min: number }
  | { kind: 'lost'; at: number }

export interface LinkState {
  /** The live session this page follows; kept through the fallback. Null in URL DEMO mode. */
  liveId: string | null
  status: MissionSession['status']
  detail?: string
  /** When the link went down; null once a live frame arrives. */
  downSince: number | null
  /** A live frame arrived for liveId (a bare `open` can still be followed by 4404). */
  everLive: boolean
  lastFrameAt: number | null
  /** Last sign of life from mission-control (a frame or a /health answer). */
  lastContactAt: number | null
  lastRunning: boolean
  /** The DEMO replay is on because mission-control is unreachable. */
  fallback: boolean
  notice: LinkNotice | null
}

const initial: LinkState = {
  liveId: null,
  status: 'idle',
  downSince: null,
  everLive: false,
  lastFrameAt: null,
  lastContactAt: null,
  lastRunning: false,
  fallback: false,
  notice: null,
}

export const useLink = create<LinkState>()(() => initial)

/** Live data saved when the fallback starts, put back when the live session returns. */
let snapshot: { route: RouteResponse | null; conditions: Conditions | null; budget: Budget | null } | null = null
let stopDemo: (() => void) | null = null
/** Last live state, for recreating the session after a mission-control restart. */
let lastLive: WsState | null = null

/** Tests only: forget everything. */
export function resetLink(): void {
  stopDemo?.()
  stopDemo = null
  snapshot = null
  lastLive = null
  useLink.setState(initial, true)
}

export function setLiveId(id: string | null): void {
  const s = useLink.getState()
  if (s.liveId === id) return
  useLink.setState({
    liveId: id,
    everLive: false,
    lastFrameAt: null,
    lastContactAt: null,
    lastRunning: false,
    // An outage in progress continues until the new session answers.
    downSince: id ? s.downSince : null,
    status: id ? s.status : 'idle',
  })
}

export function socketStatus(status: SocketStatus, detail: string | undefined, now: number): void {
  const s = useLink.getState()
  const down = status !== 'open' && status !== 'closed'
  const startsOutage = down && s.downSince === null
  useLink.setState({
    status,
    detail,
    downSince: startsOutage ? now : s.downSince,
    // A new outage hides an old "reconnected"/"restored" line; "lost" stays.
    notice: startsOutage && s.everLive && s.notice?.kind !== 'lost' ? null : s.notice,
  })
  if (!s.fallback) useMission.getState().setSessionStatus(status, detail)
}

export function socketMessage(msg: WsServerMessage, now: number): void {
  const s = useLink.getState()
  if (s.fallback) exitFallback()
  const recovered = s.everLive && s.downSince !== null
  if (msg.type === 'state') lastLive = msg
  useLink.setState({
    downSince: null,
    everLive: true,
    lastFrameAt: now,
    lastContactAt: now,
    lastRunning: msg.type === 'state' ? msg.running : s.lastRunning,
    notice: recovered && s.notice?.kind !== 'restored' ? { kind: 'reconnected', at: now } : s.notice,
  })
  useMission.getState().receive(msg)
}

/**
 * Once a second: start the fallback after 10 s down. Returns true when the socket looks dead
 * (open, running, no frame for 3 s) and should be kicked.
 */
export function tick(now: number): boolean {
  const s = useLink.getState()
  if (s.liveId && !s.fallback && s.downSince !== null && now - s.downSince >= FALLBACK_AFTER_MS) enterFallback()
  if (s.status === 'open' && s.lastRunning && s.lastFrameAt !== null && now - s.lastFrameAt > STALE_MS) {
    // One kick per stale period; the outage counts from the last sign of life, not from now.
    useLink.setState({ lastFrameAt: now, downSince: s.downSince ?? s.lastContactAt })
    return true
  }
  return false
}

export function healthOk(liveId: string, now: number): void {
  if (useLink.getState().liveId === liveId) useLink.setState({ lastContactAt: now })
}

/** /health did not answer: kick the socket if it still claims to be open. */
export function healthFailed(liveId: string): boolean {
  const s = useLink.getState()
  if (s.liveId !== liveId || s.status !== 'open') return false
  useLink.setState({ downSince: s.downSince ?? s.lastContactAt })
  return true
}

export function enterFallback(): void {
  if (useLink.getState().fallback) return
  const m = useMission.getState()
  snapshot = { route: m.route, conditions: m.conditions, budget: m.budget }
  stopDemo = startDemo()
  useLink.setState({ fallback: true })
}

export function exitFallback(): void {
  if (!useLink.getState().fallback) return
  stopDemo?.()
  stopDemo = null
  const snap = snapshot
  snapshot = null
  const { liveId, status, detail } = useLink.getState()
  const m = useMission.getState()
  m.setDemo(false)
  m.setAoi(realAoi)
  m.setRoute(snap?.route ?? null)
  m.setConditions(snap?.conditions ?? null)
  if (snap?.budget) m.setBudget(snap.budget)
  m.setSessionId(liveId)
  m.setSessionStatus(status, detail)
  useLink.setState({ fallback: false })
}

/** mission-control answered the live session with 4404 after it had been live: it restarted. */
export function sessionLost(s: Pick<LinkState, 'status' | 'detail' | 'everLive' | 'liveId'>): boolean {
  return s.status === 'rejected' && s.detail === 'unknown session' && s.everLive && s.liveId !== null
}

/** What the console needs to recreate the session: the live data, or the copy kept for the fallback. */
export function liveContext(): { route: RouteResponse | null; budget: Budget | null; state: WsState | null } {
  const m = useMission.getState()
  const fb = useLink.getState().fallback && snapshot
  return { route: fb ? snapshot!.route : m.route, budget: fb ? snapshot!.budget : m.budget, state: lastLive }
}

/**
 * Console only: a new session with the same route, at the same simulated time and speed, with the
 * storm alert re-raised so the storm still arrives when it would have. Returns the new id.
 */
export async function recreateSession(): Promise<{ id: string; t_min: number }> {
  const { route, budget, state } = liveContext()
  if (!route) throw new Error('no route to recreate the session from')
  const { id } = await missionControl.createSession(sessionBody(route, budget, realAoi))
  if (state && state.t_min > 0) await missionControl.control(id, { action: 'seek', t_min: state.t_min })
  if (state?.running) await missionControl.control(id, { action: 'start', speed: state.speed })
  const lead = timeToStorm(state)
  if (lead !== null) await missionControl.event(id, { type: 'storm_alert', lead_min: lead })
  return { id, t_min: state?.t_min ?? 0 }
}

export interface BannerView {
  tone: 'ok' | 'warn' | 'bad'
  text: string
}

/** What the link banner says, if anything. Pure, so it is tested without rendering. */
export function linkBanner(link: LinkState, role: Role, now: number): BannerView | null {
  const n = link.notice
  if (n?.kind === 'lost') {
    return {
      tone: 'bad',
      text:
        role === 'cuff'
          ? 'Session ended on mission-control · scan the new QR on the console'
          : 'Session ended on mission-control · create a new session',
    }
  }
  if (n?.kind === 'restored' && now - n.at < RESTORED_SHOW_MS) {
    return { tone: 'ok', text: `Mission-control restarted · session restored at ${evaClock(n.t_min)} · pair the cuff again` }
  }
  if (!link.liveId) return null
  if (link.fallback) return { tone: 'bad', text: 'Mission-control unreachable · showing DEMO DATA · reconnecting' }
  if (link.downSince !== null) {
    const down = Math.max(0, now - link.downSince)
    if (link.everLive || down >= FIRST_CONNECT_GRACE_MS) {
      const left = Math.max(0, Math.ceil((FALLBACK_AFTER_MS - down) / 1000))
      const what = link.everLive ? 'Lost mission-control' : 'Cannot reach mission-control'
      return { tone: 'warn', text: `${what} · reconnecting · DEMO DATA in ${left} s` }
    }
  }
  if (n?.kind === 'reconnected' && now - n.at < RECONNECTED_SHOW_MS) {
    return { tone: 'ok', text: 'Reconnected · session resumed' }
  }
  return null
}
