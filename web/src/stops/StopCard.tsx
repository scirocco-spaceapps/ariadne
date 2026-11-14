import { useMission } from '../app/store'
import type { StopContent } from '../lib/types'
import { targetLine } from './format'
import { useStopContent } from './loader'
import { PhotoViewer } from './PhotoViewer'
import './stops.css'
import { isTicked, useStopTasks } from './taskStore'

export type StopCardVariant = 'console' | 'cuff'

export interface StopCardProps {
  /** `console` for the side panel, `cuff` for the wrist display. */
  variant: StopCardVariant
  /** Stop or target id. Omitted: the store's selectedTarget, else selectedStop. */
  id?: string | null
  /** Content to show directly instead of looking `id` up. */
  content?: StopContent
}

/** A stop's (or a never-visited target's) science question, tasks and rover photos. */
export function StopCard({ variant, id, content }: StopCardProps) {
  const selected = useMission((s) => s.selectedTarget ?? s.selectedStop)
  const wantedId = content?.id ?? id ?? selected
  const loaded = useStopContent(content ? null : wantedId)
  const c = content ?? loaded.content
  const synthetic = content ? false : loaded.synthetic

  if (!c) {
    return (
      <section className={`stop-card stop-card--${variant} stop-card--empty`} data-testid="stop-card">
        <p>{wantedId ? `No content for ${wantedId}.` : 'Select a stop or target.'}</p>
        {variant === 'console' && loaded.errors.length > 0 && (
          <ul className="stop-errors">
            {loaded.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </section>
    )
  }

  const seen = targetLine(c)
  return (
    <article
      className={`stop-card stop-card--${variant}`}
      data-testid="stop-card"
      data-variant={variant}
      aria-labelledby={`stop-${variant}-${c.id}`}
    >
      <header className="stop-head">
        <h2 id={`stop-${variant}-${c.id}`}>{c.name}</h2>
        <div className="stop-badges">
          <span className={`stop-badge stop-badge--${c.kind}`}>{c.kind === 'target' ? 'Target' : 'Stop'}</span>
          <span className="stop-badge stop-badge--prov" title="Provenance">
            {c.provenance}
          </span>
          {synthetic && <span className="stop-badge stop-badge--synthetic">SYNTHETIC</span>}
          {c.draft && (
            <span className="stop-badge stop-badge--draft" title="Science text not reviewed yet">
              Draft
            </span>
          )}
        </div>
        <p className="stop-unit">Unit: {c.unit}</p>
      </header>

      {seen && (
        <p className="stop-seen" data-testid="stop-seen">
          {seen}
          <span className="stop-badge stop-badge--prov" title="Provenance">
            {c.provenance}
          </span>
        </p>
      )}

      <section className="stop-question">
        <h3>Science question</h3>
        <p>{c.science_question}</p>
      </section>

      {c.tasks.length > 0 && <TaskList stopId={c.id} tasks={c.tasks} variant={variant} />}

      <PhotoViewer key={c.id} photos={c.photos} label={c.name} />

      {variant === 'console' && (
        <section className="stop-sources">
          <h3>Sources</h3>
          <ul>
            {c.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}

function TaskList({ stopId, tasks, variant }: { stopId: string; tasks: string[]; variant: StopCardVariant }) {
  const ticks = useStopTasks((s) => s.ticks)
  const toggle = useStopTasks((s) => s.toggle)
  const done = tasks.filter((_, i) => isTicked(ticks, stopId, i)).length
  return (
    <section className="stop-tasks">
      <h3>
        Tasks{' '}
        <span className="stop-tasks-count">
          {done} / {tasks.length}
        </span>
      </h3>
      <ul>
        {tasks.map((t, i) => (
          <li key={i}>
            <label>
              <input
                type="checkbox"
                checked={isTicked(ticks, stopId, i)}
                onChange={() => toggle(stopId, i)}
                name={`${variant}-${stopId}-task-${i}`}
              />
              <span>{t}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
