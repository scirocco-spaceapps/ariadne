// Where a phone goes to pair as the cuff of the current session.

/** The /cuff URL for a session, or the DEMO replay (locked to the wall clock, so it stays in step). */
export function cuffUrl(origin: string, sessionId: string | null, demo: boolean): string | null {
  const base = origin.replace(/\/+$/, '') + '/cuff'
  if (demo) return `${base}?demo=1`
  if (!sessionId) return null
  return `${base}?s=${encodeURIComponent(sessionId)}`
}

/** True for hosts a phone cannot reach: the console must be opened on its LAN address instead. */
export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '::1' || hostname === '[::1]' || hostname.startsWith('127.')
}
