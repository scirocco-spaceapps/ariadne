import { useEffect } from 'react'
import { missionControl } from '../lib/api'
import { isDemo, wsUrl, type Role } from '../lib/config'
import { aoi } from '../lib/fixtures'
import { connectSession } from '../lib/socket'
import { startDemo } from './demo'
import { useMission } from './store'

/**
 * Fills the store once per page: the DEMO replay, or the real AOI plus live conditions and the
 * session named by ?s=<id>.
 */
export function useMissionBootstrap(search: string): void {
  useEffect(() => {
    if (isDemo(search)) return startDemo()

    const store = useMission.getState()
    store.setDemo(false)
    store.setAoi(aoi)
    store.setBudget({ budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min })
    const id = new URLSearchParams(search).get('s')
    if (id) store.setSessionId(id)

    const ctl = new AbortController()
    missionControl
      .conditions(ctl.signal)
      .then((c) => useMission.getState().setConditions(c))
      .catch(() => useMission.getState().setConditions(null))
    return () => ctl.abort()
  }, [search])
}

/** Keeps a WebSocket open to the current session (live mode only). */
export function useSessionSocket(role: Role): void {
  const demo = useMission((s) => s.demo)
  const id = useMission((s) => s.session.id)
  useEffect(() => {
    if (demo || !id) return
    const { receive, setSessionStatus } = useMission.getState()
    const sock = connectSession({ url: wsUrl(id, role), role, onMessage: receive, onStatus: setSessionStatus })
    return () => sock.close()
  }, [demo, id, role])
}
