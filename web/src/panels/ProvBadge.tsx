import type { Provenance } from '../lib/types'

/** Provenance label every number on screen carries (root CLAUDE.md, Provenance). */
export function ProvBadge({ p }: { p: Provenance }) {
  return (
    <span className={`pn-prov pn-prov-${p.toLowerCase()}`} title="Provenance">
      {p}
    </span>
  )
}

/** Whether a condition part is recorded (archive) or fetched from an upstream feed now (live). */
export function ModeBadge({ mode }: { mode: 'archive' | 'live' }) {
  return (
    <span className={`pn-mode pn-mode-${mode}`} title={mode === 'live' ? 'Fetched from a live feed' : 'Recorded values'}>
      {mode === 'live' ? 'LIVE' : 'ARCHIVE'}
    </span>
  )
}
