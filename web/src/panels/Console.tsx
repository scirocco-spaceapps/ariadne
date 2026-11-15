import { useEffect, useMemo, useState } from 'react'
import { useMission } from '../app/store'
import { assetsUrl } from '../lib/config'
import { aoi } from '../lib/fixtures'
import { LayerToggle, MapView, fixtureSource, remoteSource, type MapInset } from '../map'
import { MissionHud } from './MissionHud'
import { RightTabs } from './RightTabs'
import { SessionBar } from './SessionBar'
import { minSec, timeToStorm } from './session'
import './console.css'
import './console-theme.css'
import './console-hud.css'

const STATUS: Record<string, string> = {
  idle: 'No session',
  connecting: 'Connecting',
  open: 'Connected',
  reconnecting: 'Reconnecting',
  rejected: 'Rejected',
  closed: 'Closed',
}

/**
 * Where the floating panels sit, so the map fits the AOI into the free middle. Must match
 * console-hud.css (panel widths, HUD height, dock height).
 */
function useInset(left: boolean, right: boolean): MapInset {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1920 : window.innerWidth))
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return useMemo(() => {
    const big = w >= 1800
    const rail = 76
    return {
      top: big ? 150 : 136,
      bottom: big ? 120 : 112,
      left: left ? (big ? 330 : 280) : rail,
      right: right ? (big ? 500 : 420) : rail,
    }
  }, [w, left, right])
}

/** Mission console: the map fills the screen; HUD, layers, tabs and the session dock float over it. */
export function Console() {
  const demo = useMission((s) => s.demo)
  const status = useMission((s) => s.session.status)
  const detail = useMission((s) => s.session.statusDetail)
  const id = useMission((s) => s.session.id)
  // DEMO uses the SYNTHETIC fixtures; live mode the real AOI on the asset host.
  const source = useMemo(() => (demo ? fixtureSource() : remoteSource(aoi, assetsUrl)), [demo])
  const state = useMission((s) => s.session.state)
  const storm = timeToStorm(state)
  // Clean by default: the terrain and the headline instrument; layers and mission data open on demand.
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  const inset = useInset(leftOpen, rightOpen)
  const tone = status === 'open' ? 'ok' : status === 'connecting' || status === 'reconnecting' ? 'warn' : 'off'

  return (
    <div
      className={['cx cx--hud', storm !== null && 'cx--storm', leftOpen && 'cx--left-open', rightOpen && 'cx--right-open']
        .filter(Boolean)
        .join(' ')}
    >
      <main className="cx-map">
        <MapView source={source} inset={inset} />
        {storm !== null && (
          <div className="cx-storm-banner" aria-hidden="true">
            <span className="cx-storm-banner-k">Storm alert</span>
            <span className="cx-storm-banner-t">{minSec(storm)}</span>
            <span className="cx-storm-banner-s">to the storm · astronaut follows the thread home · Simulation</span>
          </div>
        )}
      </main>
      <div className="cx-vignette" aria-hidden="true" />
      <div className="cx-scan" aria-hidden="true" />
      <header className="cx-head">
        <h1 className="cx-title">
          <svg viewBox="0 0 32 20" width="34" height="21" aria-hidden="true" className="cx-glyph">
            <path d="M2 16 C 8 2, 14 18, 20 8 S 27 4, 26 10" />
            <circle cx="27" cy="12" r="3.2" />
          </svg>
          Ariadne <span className="cx-sub">mission console</span>
        </h1>
        <span className="cx-place">Bright Angel · Jezero crater</span>
        <span className={`cx-pill cx-pill-${tone}`} role="status" data-testid="session-status">
          {demo ? 'DEMO replay' : STATUS[status] ?? status}
          {status === 'rejected' && detail ? `: ${detail}` : ''}
          {!demo && id ? <span className="cx-pill-id"> · {id}</span> : null}
        </span>
      </header>
      <MissionHud source={source} />
      <button
        type="button"
        className="cx-rail cx-rail--left"
        aria-expanded={leftOpen}
        aria-controls="cx-layers"
        onClick={() => setLeftOpen((v) => !v)}
      >
        <span aria-hidden="true">{leftOpen ? '‹' : '›'}</span> Layers
      </button>
      <button
        type="button"
        className="cx-rail cx-rail--right"
        aria-expanded={rightOpen}
        aria-controls="cx-data"
        onClick={() => setRightOpen((v) => !v)}
      >
        Mission data <span aria-hidden="true">{rightOpen ? '›' : '‹'}</span>
      </button>
      <aside className="cx-left" id="cx-layers" aria-label="Map layers">
        <LayerToggle />
      </aside>
      <aside className="cx-right" id="cx-data" aria-label="Route, conditions and stop">
        <RightTabs />
      </aside>
      <SessionBar />
    </div>
  )
}
