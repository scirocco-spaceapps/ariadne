import { useEffect, useState } from 'react'
import type { Role } from '../lib/config'
import { linkBanner, useLink } from './link'
import './link.css'

/**
 * Connection banner for the console (over the map, under the header) and the cuff (bottom edge).
 * Fixed overlay: it never moves the layout under it.
 */
export function LinkBanner({ role }: { role: Role }) {
  const link = useLink()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [])
  const view = linkBanner(link, role, now)
  if (!view) return null
  return (
    <div className={`link-banner link-banner--${role} link-banner--${view.tone}`} role="status" aria-live="polite" data-testid="link-banner">
      {view.text}
    </div>
  )
}
