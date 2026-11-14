// Where a phone goes to pair as the cuff of the current session.
import { routeStops } from '../cuff/cuffModel'
import type { RouteResponse } from '../lib/types'

/**
 * The /cuff URL for a session, or the DEMO replay (locked to the wall clock, so it stays in step).
 * With a route it also carries the stop order (stops=a,b,c&home=1): mission-control has no endpoint
 * for a session's route, so the cuff asks the planner for the same one.
 */
export function cuffUrl(
  origin: string,
  sessionId: string | null,
  demo: boolean,
  route: RouteResponse | null = null,
): string | null {
  const base = origin.replace(/\/+$/, '') + '/cuff'
  if (demo) return `${base}?demo=1`
  if (!sessionId) return null
  const q = new URLSearchParams({ s: sessionId })
  if (route) {
    const { stops, home } = routeStops(route)
    if (stops.length > 0) q.set('stops', stops.join(','))
    q.set('home', home ? '1' : '0')
  }
  return `${base}?${q.toString().replace(/%2C/g, ',')}`
}

/** True for hosts a phone cannot reach: the console must be opened on its LAN address instead. */
export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname.startsWith('127.')
}
