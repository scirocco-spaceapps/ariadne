import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useMission } from '../app/store'
import { ApiError, missionControl } from '../lib/api'
import type { ConditionSource, Conditions } from '../lib/types'
import {
  PART_TITLE,
  formatNumber,
  formatUnit,
  formatUtc,
  partState,
  valueLabel,
  type PartKey,
} from './conditions'
import { ModeBadge, ProvBadge } from './ProvBadge'
import './panels.css'

type Status = 'loading' | 'ok' | 'error'

/**
 * Conditions from the store. DEMO: the SYNTHETIC fixture already in the store. Live: fetched from
 * mission-control, with a refresh; a failed refresh keeps the last good copy on screen.
 */
function useConditions() {
  const demo = useMission((s) => s.demo)
  const conditions = useMission((s) => s.conditions)
  const [status, setStatus] = useState<Status>(conditions ? 'ok' : 'loading')
  const [error, setError] = useState<string | null>(null)

  // Sets state only once the request settles.
  const load = useCallback((signal?: AbortSignal) => {
    missionControl
      .conditions(signal)
      .then((c) => {
        useMission.getState().setConditions(c)
        setError(null)
        setStatus('ok')
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return
        setError(err instanceof ApiError ? err.detail : 'mission-control is unreachable')
        setStatus('error')
      })
  }, [])

  useEffect(() => {
    if (demo) return // the DEMO fixture is already in the store
    const ctl = new AbortController()
    load(ctl.signal)
    return () => ctl.abort()
  }, [demo, load])

  const refresh = () => {
    setStatus('loading')
    load()
  }

  return { demo, conditions, status: demo ? 'ok' : status, error, refresh }
}

function SourceLine({ part }: { part: ConditionSource }) {
  return (
    <div className="pn-source">
      <ProvBadge p={part.provenance} />
      <ModeBadge mode={part.mode} />
      {part.source_url ? (
        <a href={part.source_url} target="_blank" rel="noreferrer">
          {part.source}
        </a>
      ) : (
        <span>{part.source}</span>
      )}
    </div>
  )
}

function Card({ part, title, children }: { part: PartKey; title: string; children: ReactNode }) {
  return (
    <section className={`pn-card pn-card-${part}`} aria-label={title} data-testid={`cond-${part}`}>
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function Missing({ reason }: { reason: string }) {
  return (
    <p className="pn-missing">
      <strong>Not available.</strong> {reason}
    </p>
  )
}

function Placeholder({ status }: { status: Status }) {
  return <p className="pn-placeholder">{status === 'loading' ? 'Loading…' : 'No data.'}</p>
}

function WeatherBody({ c }: { c: Conditions }) {
  const w = c.weather!
  return (
    <>
      <dl className="pn-values">
        <div className="pn-row">
          <dt>Sol</dt>
          <dd>{w.sol ?? '—'}</dd>
        </div>
        {Object.entries(w.values).map(([k, v]) => (
          <div key={k} className="pn-row">
            <dt>{valueLabel(k)}</dt>
            <dd>
              {formatNumber(v)} {v === null ? '' : formatUnit(w.units[k])}
            </dd>
          </div>
        ))}
      </dl>
      <SourceLine part={w} />
    </>
  )
}

function RadiationBody({ c }: { c: Conditions }) {
  const r = c.radiation!
  return (
    <>
      <p className="pn-big">
        {formatNumber(r.value)} {r.unit}
      </p>
      {r.measured_at && <p className="pn-sub">{r.measured_at}</p>}
      <SourceLine part={r} />
    </>
  )
}

function SpaceWeatherBody({ c }: { c: Conditions }) {
  const sw = c.space_weather!
  return (
    <>
      {sw.stale && (
        <p className="pn-stale" role="status">
          Stale: the last refresh failed, showing the last good copy.
        </p>
      )}
      {sw.events.length === 0 ? (
        <p className="pn-sub">No CME arrivals at Mars forecast.</p>
      ) : (
        <ul className="pn-events">
          {sw.events.map((e) => (
            <li key={e.id}>
              <span className="pn-event-time">Mars arrival {formatUtc(e.mars_arrival_utc)}</span>
              <span className="pn-sub">
                {e.id} · {e.source}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="pn-sub">Fetched {formatUtc(sw.fetched_at)}</p>
      <SourceLine part={sw} />
    </>
  )
}

function PartnerBody({ c }: { c: Conditions }) {
  const p = c.partner!
  return (
    <>
      <p className="pn-sub">
        {p.agency} · {p.mission}
      </p>
      <p className="pn-big">
        {formatNumber(p.value)} {p.unit}
      </p>
      {p.description && <p className="pn-sub">{p.description}</p>}
      <SourceLine part={p} />
    </>
  )
}

const BODY: Record<PartKey, (props: { c: Conditions }) => ReactNode> = {
  weather: WeatherBody,
  radiation: RadiationBody,
  space_weather: SpaceWeatherBody,
  partner: PartnerBody,
}

/** Weather, radiation and space weather, plus a partner value when there is one. */
export function ConditionsPanel() {
  const { demo, conditions: c, status, error, refresh } = useConditions()
  // The partner slot is hidden when the service has no partner value.
  const errorText = error
    ? `Could not load conditions: ${error}.${c ? ' Showing the last good copy.' : ''}`
    : undefined
  const parts: PartKey[] = ['weather', 'radiation', 'space_weather']
  if (c?.partner) parts.push('partner')

  return (
    <div className="pn-panel" data-testid="conditions-panel">
      <header className="pn-head">
        <h2>Conditions</h2>
        {!demo && (
          <button type="button" onClick={refresh} disabled={status === 'loading'}>
            {status === 'loading' ? 'Loading…' : 'Refresh'}
          </button>
        )}
      </header>
      <p className={`pn-error${error ? '' : ' pn-hidden'}`} role={error ? 'alert' : undefined} title={errorText}>
        {errorText ?? ' '}
      </p>
      {parts.map((part) => {
        const Body = BODY[part]
        const st = c ? partState(c, part) : null
        return (
          <Card key={part} part={part} title={PART_TITLE[part]}>
            {!c || !st ? <Placeholder status={status} /> : "reason" in st ? <Missing reason={st.reason} /> : <Body c={c} />}
          </Card>
        )
      })}
    </div>
  )
}
