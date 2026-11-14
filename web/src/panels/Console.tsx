import { useMemo } from 'react'
import { useMission } from '../app/store'
import { assetsUrl } from '../lib/config'
import { aoi } from '../lib/fixtures'
import { LayerToggle, MapView, fixtureSource, remoteSource } from '../map'
import { RightTabs } from './RightTabs'
import { SessionBar } from './SessionBar'
import './console.css'

const STATUS: Record<string, string> = {
  idle: 'No session',
  connecting: 'Connecting',
  open: 'Connected',
  reconnecting: 'Reconnecting',
  rejected: 'Rejected',
  closed: 'Closed',
}

/** Mission console: layers left, map centre, Route / Conditions / Stop right, session bar below. */
export function Console() {
  const demo = useMission((s) => s.demo)
  const status = useMission((s) => s.session.status)
  const detail = useMission((s) => s.session.statusDetail)
  const id = useMission((s) => s.session.id)
  // DEMO uses the SYNTHETIC fixtures; live mode the real AOI on the asset host.
  const source = useMemo(() => (demo ? fixtureSource() : remoteSource(aoi, assetsUrl)), [demo])
  const tone = status === 'open' ? 'ok' : status === 'connecting' || status === 'reconnecting' ? 'warn' : 'off'

  return (
    <div className="cx">
      <header className="cx-head">
        <h1 className="cx-title">
          Ariadne <span className="cx-sub">mission console</span>
        </h1>
        <span className="cx-place">Bright Angel · Jezero crater</span>
        <span className={`cx-pill cx-pill-${tone}`} role="status" data-testid="session-status">
          {demo ? 'DEMO replay' : STATUS[status] ?? status}
          {status === 'rejected' && detail ? `: ${detail}` : ''}
          {!demo && id ? <span className="cx-pill-id"> · {id}</span> : null}
        </span>
      </header>
      <aside className="cx-left" aria-label="Map layers">
        <LayerToggle />
      </aside>
      <main className="cx-map">
        <MapView source={source} />
      </main>
      <aside className="cx-right" aria-label="Route, conditions and stop">
        <RightTabs />
      </aside>
      <SessionBar />
    </div>
  )
}
