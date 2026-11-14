import { useMemo } from 'react'
import { useMission } from '../app/store'
import { assetsUrl } from '../lib/config'
import { aoi } from '../lib/fixtures'
import { LayerToggle, MapView, fixtureSource, remoteSource } from '../map'
import { ConditionsPanel } from './ConditionsPanel'
import { RouteSheet } from './RouteSheet'
import { SessionControls } from './SessionControls'

/** Console until the N6 layout: the map with its layer toggles, and the session line. */
export function ConsolePlaceholder() {
  const demo = useMission((s) => s.demo)
  const status = useMission((s) => s.session.status)
  const state = useMission((s) => s.session.state)
  // DEMO uses the SYNTHETIC fixtures; live mode the real AOI on the asset host.
  const source = useMemo(() => (demo ? fixtureSource() : remoteSource(aoi, assetsUrl)), [demo])
  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100vh', margin: 0, background: '#fff', color: '#111', colorScheme: 'light' }}>
      <header style={{ padding: '8px 12px' }}>
        <h1 style={{ margin: 0, fontSize: 20 }}>Ariadne mission console</h1>
        <p data-testid="session-line" style={{ margin: 0 }}>
          Session: {status}
          {state && <> · T+{state.t_min.toFixed(1)} min · pos {state.pos.map((v) => v.toFixed(0)).join(', ')} m ({state.provenance})</>}
        </p>
        <SessionControls />
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 220, padding: 8, overflow: 'auto' }}>
          <LayerToggle />
        </aside>
        <div style={{ flex: 1, position: 'relative' }}>
          <MapView source={source} />
        </div>
        <aside className="pn-column" aria-label="Route and conditions">
          <RouteSheet />
          <ConditionsPanel />
        </aside>
      </div>
    </main>
  )
}
