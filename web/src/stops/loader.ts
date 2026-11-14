// Loads stop content and keeps only entries that pass validation. Until F3 lands real files in
// content/stops/<id>.json, the app reads the SYNTHETIC contracts/fixtures/stops.json.
import { useMemo } from 'react'
import { fixtures } from '../lib/fixtures'
import type { StopContent } from '../lib/types'
import { validateStopContent } from './validate'

export interface StopSet {
  /** Valid stop content by id. */
  stops: Record<string, StopContent>
  /** Every validation problem, prefixed with where it came from. Invalid entries are dropped. */
  errors: string[]
}

/** Validate a list of stop content objects (the fixture's shape). Duplicate ids are errors. */
export function parseStops(raws: unknown, label: string): StopSet {
  if (!Array.isArray(raws)) return { stops: {}, errors: [`${label}: must be an array of stop content`] }
  const stops: Record<string, StopContent> = {}
  const errors: string[] = []
  raws.forEach((raw, i) => {
    const r = validateStopContent(raw, `${label}[${i}]`)
    if (!r.ok) {
      errors.push(...r.errors)
    } else if (r.value.id in stops) {
      errors.push(`${label}[${i}]: duplicate id "${r.value.id}"`)
    } else {
      stops[r.value.id] = r.value
    }
  })
  return { stops, errors }
}

/**
 * Validate content/stops/<id>.json files, keyed by path (as from import.meta.glob). The file name
 * must equal the id. `index.json` is Bunyamin's stop list in another shape and is skipped.
 */
export function loadStopFiles(files: Record<string, unknown>): StopSet {
  const stops: Record<string, StopContent> = {}
  const errors: string[] = []
  for (const [path, raw] of Object.entries(files)) {
    const name = path.split('/').pop() ?? path
    if (name === 'index.json') continue
    if (!name.endsWith('.json')) {
      errors.push(`${path}: not a .json file`)
      continue
    }
    const r = validateStopContent(raw, path)
    if (!r.ok) {
      errors.push(...r.errors)
      continue
    }
    const expected = name.slice(0, -'.json'.length)
    if (r.value.id !== expected) {
      errors.push(`${path}: id "${r.value.id}" does not match the file name "${expected}"`)
    } else if (r.value.id in stops) {
      errors.push(`${path}: duplicate id "${r.value.id}"`)
    } else {
      stops[r.value.id] = r.value
    }
  }
  return { stops, errors }
}

export const FIXTURE_LABEL = 'contracts/fixtures/stops.json'

let fixtureCache: StopSet | null = null

/** The SYNTHETIC fixture stops, validated once. */
export function fixtureStops(): StopSet {
  fixtureCache ??= parseStops(fixtures.stops, FIXTURE_LABEL)
  return fixtureCache
}

export interface StopContentResult {
  content: StopContent | null
  /** True while content comes from the SYNTHETIC fixtures. */
  synthetic: boolean
  errors: string[]
}

/** Stop content for one id. The one place to switch to real content (F3). */
export function useStopContent(id: string | null | undefined): StopContentResult {
  return useMemo(() => {
    const set = fixtureStops()
    return { content: id ? (set.stops[id] ?? null) : null, synthetic: true, errors: set.errors }
  }, [id])
}
