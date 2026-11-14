import { useEffect, useMemo, useState } from 'react'
import { useMission } from '../app/store'
import { ApiError, planner } from '../lib/api'
import { fixtures } from '../lib/fixtures'
import type { Aoi, RouteResponse } from '../lib/types'
import { elevationSeries, loadDem, type ElevPoint } from './elevation'
import { ElevationLine } from './ElevationLine'
import { ProvBadge } from './ProvBadge'
import { evaClock, legRows, placeName } from './route'
import './panels.css'

interface StopChoice {
  id: string
  on: boolean
}

const PLACEHOLDER_ROWS = 3

function initialOrder(aoi: Aoi | null): StopChoice[] {
  return (aoi?.stops ?? []).map((s) => ({ id: s.id, on: true }))
}

function fmt(v: number, digits = 0): string {
  return v.toFixed(digits)
}

/**
 * Route sheet: choose and order the stops, ask the planner for a route, and show the legs with the
 * EVA clock and budget at each arrival, plus elevation over time. DEMO or a planner error shows the
 * SYNTHETIC fixture route with a notice.
 */
export function RouteSheet() {
  const demo = useMission((s) => s.demo)
  const aoi = useMission((s) => s.aoi)
  const route = useMission((s) => s.route)
  const budget = useMission((s) => s.budget)

  const [order, setOrder] = useState<StopChoice[]>(() => initialOrder(aoi))
  const [orderAoi, setOrderAoi] = useState(aoi)
  const [returnHome, setReturnHome] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // Elevation for one route; a result for an older route counts as still loading.
  const [elevResult, setElevResult] = useState<{ route: RouteResponse; points: ElevPoint[] | null } | null>(null)

  // A new AOI resets the stop list (React's "adjust state when a prop changes" pattern).
  if (orderAoi !== aoi) {
    setOrderAoi(aoi)
    setOrder(initialOrder(aoi))
  }

  // The fixture route belongs to the fixture AOI: name its stops and sample its DEM from there.
  const isFixture = route === fixtures.route
  const routeAoi = isFixture ? fixtures.aoi : aoi
  const rows = useMemo(() => (route ? legRows(route, budget) : []), [route, budget])

  useEffect(() => {
    if (!route || !routeAoi) return
    const ctl = new AbortController()
    loadDem(routeAoi, isFixture, ctl.signal).then((dem) => {
      if (!ctl.signal.aborted) setElevResult({ route, points: dem ? elevationSeries(route, dem) : null })
    })
    return () => ctl.abort()
  }, [route, routeAoi, isFixture])

  const elevCurrent = route && elevResult?.route === route ? elevResult : null
  const elev = elevCurrent?.points ?? null
  const elevMsg = !route
    ? 'No route yet.'
    : !elevCurrent
      ? 'Loading elevation…'
      : elevCurrent.points
        ? undefined
        : 'Elevation unavailable (DEM not loaded).'

  const chosen = order.filter((s) => s.on).map((s) => s.id)

  const move = (i: number, by: -1 | 1) =>
    setOrder((o) => {
      const j = i + by
      if (j < 0 || j >= o.length) return o
      const next = o.slice()
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const plan = async () => {
    const { setRoute } = useMission.getState()
    if (demo) {
      setRoute(fixtures.route)
      setNotice('DEMO: SYNTHETIC fixture route.')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      setRoute(await planner.route({ stops: chosen, return_home: returnHome }))
    } catch (err) {
      const why = err instanceof ApiError ? err.detail : 'planner is unreachable'
      setRoute(fixtures.route)
      setNotice(`Planner: ${why}. Showing the SYNTHETIC fixture route.`)
    } finally {
      setBusy(false)
    }
  }

  const tableProv = isFixture ? 'Simulation' : (route?.provenance ?? 'Modeled')

  return (
    <div className="pn-panel" data-testid="route-sheet">
      <header className="pn-head">
        <h2>Route</h2>
        {route && <ProvBadge p={tableProv} />}
      </header>

      <ol className="pn-stops" aria-label="Stop order">
        {order.map((s, i) => (
          <li key={s.id}>
            <label>
              <input
                type="checkbox"
                checked={s.on}
                onChange={() => setOrder((o) => o.map((x) => (x.id === s.id ? { ...x, on: !x.on } : x)))}
              />
              {placeName(aoi, s.id)}
            </label>
            <span className="pn-stop-move">
              <button type="button" aria-label={`Move ${s.id} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${s.id} down`}
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="pn-plan">
        <label>
          <input type="checkbox" checked={returnHome} onChange={() => setReturnHome((v) => !v)} />
          Return to safe haven
        </label>
        <button type="button" onClick={plan} disabled={busy || (!demo && chosen.length === 0)}>
          {busy ? 'Planning…' : 'Plan route'}
        </button>
      </div>
      <p
        className={`pn-notice${notice ? '' : ' pn-hidden'}`}
        role={notice ? 'status' : undefined}
        title={notice ?? undefined}
      >
        {notice ?? ' '}
      </p>

      <div className="pn-table-wrap">
        <table className="pn-table">
          <thead>
            <tr>
              <th>Leg</th>
              <th title="Distance">m</th>
              <th title="Walk time">min</th>
              <th title="Climb">↑ m</th>
              <th title="Max slope">°</th>
              <th title="EVA clock at arrival">Arrive</th>
              <th title="Budget left at arrival">Left</th>
            </tr>
          </thead>
          <tbody>
            {route
              ? rows.map((r) => (
                  <tr key={r.leg} className={r.belowReserve ? 'pn-reserve' : undefined}>
                    <td>
                      {placeName(routeAoi, r.from)} → {placeName(routeAoi, r.to)}
                    </td>
                    <td>{fmt(r.distance_m)}</td>
                    <td>{fmt(r.time_min, 1)}</td>
                    <td>{fmt(r.climb_m, 1)}</td>
                    <td>{fmt(r.max_slope_deg, 1)}</td>
                    <td>{evaClock(r.arrive_t)}</td>
                    <td title={r.belowReserve ? 'Below the reserve' : undefined}>
                      {r.budget_left === null ? '—' : `${fmt(r.budget_left)} min`}
                    </td>
                  </tr>
                ))
              : Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
                  <tr key={i} className="pn-empty-row">
                    <td colSpan={7}>{i === 0 ? 'No route yet. Choose stops and press Plan route.' : ' '}</td>
                  </tr>
                ))}
          </tbody>
          {route && (
            <tfoot>
              <tr>
                <td>Total (walk {fmt(route.totals.walk_min)} + dwell {fmt(route.totals.dwell_min)} min)</td>
                <td>{fmt(route.totals.distance_m)}</td>
                <td colSpan={3} />
                <td>{evaClock(route.totals.eva_min)}</td>
                <td>{budget ? `${fmt(budget.budget_min - route.totals.eva_min)} min` : '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="pn-sub">
        {budget ? (
          <>
            Budget {budget.budget_min} min, reserve {budget.reserve_min} min <ProvBadge p="Assumed" />
          </>
        ) : (
          'Budget: —'
        )}
      </p>

      <ElevationLine points={elev} provenance={isFixture ? 'Simulation' : 'Derived'} message={elevMsg} />
    </div>
  )
}
