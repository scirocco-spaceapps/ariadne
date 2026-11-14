import { useCallback, useEffect, useRef, useState } from 'react'

export type WakeState = 'off' | 'on' | 'unsupported' | 'refused'

/**
 * Keeps the phone screen on while walking. Browsers only grant a wake lock from a user gesture
 * and drop it when the page is hidden, so: request on tap, ask again when the page comes back.
 */
export function useWakeLock(): { state: WakeState; request: () => void } {
  const [state, setState] = useState<WakeState>('off')
  const lock = useRef<WakeLockSentinel | null>(null)
  const wanted = useRef(false)

  const request = useCallback(() => {
    const wl = typeof navigator !== 'undefined' ? navigator.wakeLock : undefined
    if (!wl) {
      setState('unsupported')
      return
    }
    wanted.current = true
    wl.request('screen').then(
      (sentinel) => {
        lock.current = sentinel
        setState('on')
        sentinel.addEventListener('release', () => {
          lock.current = null
          setState((s) => (s === 'on' ? 'off' : s))
        })
      },
      () => setState('refused'),
    )
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wanted.current && !lock.current) request()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      void lock.current?.release().catch(() => {})
    }
  }, [request])

  return { state, request }
}
