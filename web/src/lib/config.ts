// Service URLs and DEMO mode. URLs come from env (VITE_PLANNER_URL, VITE_MC_URL,
// VITE_ASSETS_URL); without them the dev proxy in vite.config.ts is used.

export type Role = 'console' | 'cuff'

const env = import.meta.env

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

export const plannerUrl = trimSlash(env.VITE_PLANNER_URL || '/api/planner')
export const mcUrl = trimSlash(env.VITE_MC_URL || '/api/mc')
/** Root of the asset host; join with `aoi.assets_base` and a file name. */
export const assetsUrl = env.VITE_ASSETS_URL ? trimSlash(env.VITE_ASSETS_URL) + '/' : '/'

/**
 * WebSocket URL for a session. An absolute VITE_MC_URL (https://mc.example.org) becomes
 * wss://mc.example.org/ws; a relative one uses this page's host and the dev proxy's /ws.
 */
export function wsUrl(sessionId: string, role: Role, loc: Pick<Location, 'protocol' | 'host'> = location): string {
  const q = `?s=${encodeURIComponent(sessionId)}&role=${role}`
  if (/^https?:\/\//.test(mcUrl)) {
    return mcUrl.replace(/^http/, 'ws') + '/ws' + q
  }
  const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${loc.host}/ws${q}`
}

/** DEMO mode replays contracts/fixtures instead of calling services: VITE_DEMO=1 or ?demo=1. */
export function isDemo(search: string = typeof location === 'undefined' ? '' : location.search): boolean {
  if (env.VITE_DEMO === '1') return true
  const v = new URLSearchParams(search).get('demo')
  return v === '1' || v === 'true'
}
