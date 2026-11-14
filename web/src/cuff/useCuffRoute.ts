import { useEffect, useState } from 'react'
import { useMission } from '../app/store'
import { ApiError, planner } from '../lib/api'

/**
 * The cuff runs on another device, and mission-control has no endpoint for a session's route.
 * The pairing URL carries the stop order (?stops=a,b,c&home=1); the cuff asks the planner for
 * the same route (deterministic for the same input and data) and keeps it in the store.
 * Without those params it plans the aoi.json order with return home, as Create session does.
 * DEMO mode already has the fixture route in the store.
 */
export function useCuffRoute(search: string): string | null {
  const demo = useMission((s) => s.demo)
  const id = useMission((s) => s.session.id)
  const aoi = useMission((s) => s.aoi)
  const hasRoute = useMission((s) => s.route !== null)
  const [error, setError] = useState<{ id: string; text: string } | null>(null)

  useEffect(() => {
    if (demo || !id || !aoi || hasRoute) return
    const q = new URLSearchParams(search)
    const stops = q.get('stops')?.split(',').filter(Boolean) ?? aoi.stops.map((s) => s.id)
    const home = q.get('home') !== '0'
    const ctl = new AbortController()
    planner
      .route({ stops, return_home: home }, ctl.signal)
      .then((r) => useMission.getState().setRoute(r))
      .catch((err: unknown) => {
        if (ctl.signal.aborted) return
        setError({ id, text: err instanceof ApiError ? err.detail : 'planner is unreachable' })
      })
    return () => ctl.abort()
  }, [demo, id, aoi, hasRoute, search])

  return error && error.id === id && !hasRoute ? error.text : null
}
