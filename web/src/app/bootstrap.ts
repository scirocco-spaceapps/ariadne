import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { missionControl } from '../lib/api'
import { isDemo, wsUrl, type Role } from '../lib/config'
import { aoi } from '../lib/fixtures'
import { connectSession } from '../lib/socket'
import { startDemo } from './demo'
import {
  HEALTH_EVERY_MS,
  HEALTH_TIMEOUT_MS,
  RECREATE_GIVE_UP_MS,
  RECREATE_RETRY_MS,
  enterFallback,
  healthFailed,
  healthOk,
  liveContext,
  recreateSession,
  sessionLost,
  setLiveId,
  socketMessage,
  socketStatus,
  tick,
  useLink,
} from './link'
import { useMission } from './store'

/**
 * Fills the store once per page: the DEMO replay, or the real AOI plus live conditions and the
 * session named by ?s=<id>.
 */
export function useMissionBootstrap(search: string): void {
  useEffect(() => {
    if (isDemo(search)) {
      setLiveId(null)
      return startDemo()
    }

    const id = new URLSearchParams(search).get('s')
    setLiveId(id)
    // During the fallback the DEMO replay owns the screen until mission-control answers.
    if (useLink.getState().fallback) return

    const store = useMission.getState()
    store.setDemo(false)
    store.setAoi(aoi)
    store.setBudget({ budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min })
    if (id) store.setSessionId(id)

    const ctl = new AbortController()
    missionControl
      .conditions(ctl.signal)
      .then((c) => useMission.getState().setConditions(c))
      .catch(() => useMission.getState().setConditions(null))
    return () => ctl.abort()
  }, [search])
}

/**
 * Keeps a WebSocket open to the live session, also through the DEMO fallback, and watches the
 * link once a second: fallback after 10 s down, a kick when a running session goes quiet or when
 * /health stops answering (a paused session sends no frames to go quiet).
 */
export function useSessionSocket(role: Role): void {
  const liveId = useLink((s) => s.liveId)
  useEffect(() => {
    if (!liveId) return
    const sock = connectSession({
      url: wsUrl(liveId, role),
      role,
      onMessage: (msg) => socketMessage(msg, Date.now()),
      onStatus: (status, detail) => socketStatus(status, detail, Date.now()),
    })
    let probe: AbortController | null = null
    let lastProbe = Date.now()
    const timer = setInterval(() => {
      const now = Date.now()
      if (tick(now)) sock.kick()
      if (probe || now - lastProbe < HEALTH_EVERY_MS || useLink.getState().status !== 'open') return
      lastProbe = now
      const ctl = new AbortController()
      probe = ctl
      const timeout = setTimeout(() => ctl.abort(), HEALTH_TIMEOUT_MS)
      missionControl
        .health(ctl.signal)
        .then(() => healthOk(liveId, Date.now()))
        .catch(() => {
          if (probe === ctl && healthFailed(liveId)) sock.kick()
        })
        .finally(() => {
          clearTimeout(timeout)
          if (probe === ctl) probe = null
        })
    }, 1000)
    const online = () => sock.kick()
    window.addEventListener('online', online)
    return () => {
      clearInterval(timer)
      probe?.abort()
      probe = null
      window.removeEventListener('online', online)
      sock.close()
    }
  }, [liveId, role])
}

/**
 * mission-control restarted and lost the session. The console recreates it where it was and
 * points the URL at the new id; the cuff cannot learn that id, so it shows DEMO and asks for the
 * new QR.
 */
export function useSessionRecovery(role: Role): void {
  const lost = useLink(sessionLost)
  const [, setParams] = useSearchParams()
  // The setter changes with the URL; a ref keeps a recreate in flight from being restarted.
  const setParamsRef = useRef(setParams)
  useEffect(() => {
    setParamsRef.current = setParams
  })
  useEffect(() => {
    if (!lost) return
    const giveUp = () => useLink.setState({ notice: { kind: 'lost', at: Date.now() } })
    if (role === 'cuff') {
      enterFallback()
      giveUp()
      return
    }
    // A reload that rejoined ?s= has no route: nothing to recreate from.
    if (!liveContext().route) return giveUp()
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const started = Date.now()
    const attempt = async () => {
      try {
        const { id, t_min } = await recreateSession()
        if (cancelled) return
        useLink.setState({ notice: { kind: 'restored', at: Date.now(), t_min } })
        setLiveId(id)
        setParamsRef.current(
          (p) => {
            p.set('s', id)
            return p
          },
          { replace: true },
        )
      } catch {
        if (cancelled) return
        if (Date.now() - started >= RECREATE_GIVE_UP_MS) return giveUp()
        timer = setTimeout(() => void attempt(), RECREATE_RETRY_MS)
      }
    }
    void attempt()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [lost, role])
}
