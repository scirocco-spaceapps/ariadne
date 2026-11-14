import { useState } from 'react'
import { useMission } from '../app/store'
import { StopCard } from '../stops'
import { ConditionsPanel } from './ConditionsPanel'
import { RouteSheet } from './RouteSheet'

const TABS = [
  { id: 'route', label: 'Route' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'stop', label: 'Stop' },
] as const
type TabId = (typeof TABS)[number]['id']

/**
 * Right panel: Route, Conditions and Stop. All three stay mounted so the conditions are not
 * refetched and the route sheet keeps its stop order; a stop picked on the map opens Stop.
 */
export function RightTabs() {
  const selected = useMission((s) => s.selectedTarget ?? s.selectedStop)
  const [tab, setTab] = useState<TabId>('route')
  const [seen, setSeen] = useState(selected)

  // A new selection (a stop clicked on the map) switches to the Stop tab.
  if (selected !== seen) {
    setSeen(selected)
    if (selected) setTab('stop')
  }

  return (
    <div className="cx-tabs">
      <div role="tablist" aria-label="Console panels" className="cx-tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className={tab === t.id ? 'cx-tab cx-tab-on' : 'cx-tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {TABS.map((t) => (
        <section
          key={t.id}
          role="tabpanel"
          id={`panel-${t.id}`}
          aria-labelledby={`tab-${t.id}`}
          hidden={tab !== t.id}
          className="cx-tabpanel"
        >
          {t.id === 'route' && <RouteSheet />}
          {t.id === 'conditions' && <ConditionsPanel />}
          {t.id === 'stop' && <StopCard variant="console" />}
        </section>
      ))}
    </div>
  )
}
