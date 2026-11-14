// Validation of stop content (StopContent in contracts/openapi.yaml). Hand-written so the app needs
// no JSON-schema dependency; it mirrors the schema, including additionalProperties: false.
import type { Provenance, StopContent } from '../lib/types'

/** `value` is set only when `ok` (errors is then empty). Flat shape: the web tsconfig is not strict,
 *  so a discriminated union on `ok` would not narrow. */
export interface Validation<T> {
  ok: boolean
  value: T | null
  errors: string[]
}

export const PROVENANCES: readonly Provenance[] = ['Observed', 'Derived', 'Modeled', 'Assumed', 'Simulation']
export const KINDS: readonly StopContent['kind'][] = ['stop', 'target']

const STOP_KEYS = ['id', 'name', 'kind', 'science_question', 'tasks', 'photos', 'unit', 'provenance', 'sources', 'draft']
const STOP_REQUIRED = STOP_KEYS.filter((k) => k !== 'draft')
const PHOTO_KEYS = ['file', 'page_url', 'sol', 'camera', 'credit', 'caption', 'distance_m']
const PHOTO_REQUIRED = PHOTO_KEYS.filter((k) => k !== 'distance_m')
const SOURCE_KEYS = ['title', 'url']

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isUrl(v: unknown): boolean {
  if (typeof v !== 'string') return false
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** A path relative to content/: no leading slash, no scheme, no "..", no backslashes. */
function isRelativeFile(v: unknown): boolean {
  if (typeof v !== 'string' || v.trim() === '') return false
  if (v.startsWith('/') || v.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(v)) return false
  return !v.split('/').some((part) => part === '..' || part === '')
}

function checkKeys(obj: Record<string, unknown>, allowed: string[], required: string[], at: string, errors: string[]) {
  for (const k of required) if (!(k in obj)) errors.push(`${at}${k}: required`)
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) errors.push(`${at}${k}: unknown field`)
}

function checkString(obj: Record<string, unknown>, key: string, at: string, errors: string[]) {
  if (!(key in obj)) return
  const v = obj[key]
  if (typeof v !== 'string' || v.trim() === '') errors.push(`${at}${key}: must be a non-empty string`)
}

function checkPhoto(p: unknown, at: string, errors: string[]) {
  if (!isObject(p)) {
    errors.push(`${at}: must be an object`)
    return
  }
  const pre = `${at}.`
  checkKeys(p, PHOTO_KEYS, PHOTO_REQUIRED, pre, errors)
  for (const k of ['camera', 'credit', 'caption']) checkString(p, k, pre, errors)
  if ('file' in p && !isRelativeFile(p.file)) errors.push(`${pre}file: must be a path relative to content/`)
  if ('page_url' in p && !isUrl(p.page_url)) errors.push(`${pre}page_url: must be an http(s) URL`)
  if ('sol' in p && !(Number.isInteger(p.sol) && (p.sol as number) >= 0)) {
    errors.push(`${pre}sol: must be an integer >= 0`)
  }
  if ('distance_m' in p) {
    const d = p.distance_m
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0) errors.push(`${pre}distance_m: must be a number >= 0`)
  }
}

function checkSource(s: unknown, at: string, errors: string[]) {
  if (!isObject(s)) {
    errors.push(`${at}: must be an object`)
    return
  }
  const pre = `${at}.`
  checkKeys(s, SOURCE_KEYS, SOURCE_KEYS, pre, errors)
  checkString(s, 'title', pre, errors)
  if ('url' in s && !isUrl(s.url)) errors.push(`${pre}url: must be an http(s) URL`)
}

/**
 * Check one stop content object against the StopContent schema. `where` prefixes every error
 * (e.g. a file name) so a bad file is easy to find.
 */
export function validateStopContent(raw: unknown, where = ''): Validation<StopContent> {
  const at = where ? `${where}: ` : ''
  const errors: string[] = []
  if (!isObject(raw)) return { ok: false, value: null, errors: [`${at}stop content must be an object`] }

  checkKeys(raw, STOP_KEYS, STOP_REQUIRED, at, errors)
  for (const k of ['id', 'name', 'science_question', 'unit']) checkString(raw, k, at, errors)
  if ('kind' in raw && !KINDS.includes(raw.kind as StopContent['kind'])) {
    errors.push(`${at}kind: must be one of ${KINDS.join(', ')}`)
  }
  if ('provenance' in raw && !PROVENANCES.includes(raw.provenance as Provenance)) {
    errors.push(`${at}provenance: must be one of ${PROVENANCES.join(', ')}`)
  }
  if ('tasks' in raw) {
    if (!Array.isArray(raw.tasks)) errors.push(`${at}tasks: must be an array`)
    else
      raw.tasks.forEach((t, i) => {
        if (typeof t !== 'string' || t.trim() === '') errors.push(`${at}tasks[${i}]: must be a non-empty string`)
      })
  }
  if ('photos' in raw) {
    if (!Array.isArray(raw.photos)) errors.push(`${at}photos: must be an array`)
    else raw.photos.forEach((p, i) => checkPhoto(p, `${at}photos[${i}]`, errors))
  }
  if ('sources' in raw) {
    if (!Array.isArray(raw.sources)) errors.push(`${at}sources: must be an array`)
    else if (raw.sources.length === 0) errors.push(`${at}sources: needs at least one source`)
    else raw.sources.forEach((s, i) => checkSource(s, `${at}sources[${i}]`, errors))
  }
  if ('draft' in raw && typeof raw.draft !== 'boolean') errors.push(`${at}draft: must be a boolean`)

  return errors.length
    ? { ok: false, value: null, errors }
    : { ok: true, value: raw as unknown as StopContent, errors: [] }
}
