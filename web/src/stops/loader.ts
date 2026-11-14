// Loads stop content and keeps only entries that pass validation. Live mode reads the real files in
// content/stops/<id>.json (F3); DEMO mode reads the SYNTHETIC contracts/fixtures/stops.json.
import { useEffect, useMemo, useState } from 'react'
import { useMission } from '../app/store'
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

/** Loaders for content/stops/*.json, keyed by path. Lazy on purpose: a file the dev server refuses
 *  (server.fs.allow) becomes a loader error instead of breaking the whole app, DEMO mode included. */
export type StopModules = Record<string, () => Promise<unknown>>

const contentModules: StopModules = import.meta.glob('../../../content/stops/*.json', { import: 'default' })

/** Load and validate content/stops/<id>.json. index.json is never loaded. A file that fails to load
 *  is reported as an error; the others still load. */
export async function loadLiveStops(modules: StopModules = contentModules): Promise<StopSet> {
  const entries = Object.entries(modules).filter(([path]) => path.split('/').pop() !== 'index.json')
  const loadErrors: string[] = []
  const loaded = await Promise.all(
    entries.map(async ([path, load]): Promise<[string, unknown] | null> => {
      try {
        return [path, await load()]
      } catch (e) {
        loadErrors.push(`${path}: could not load (${e instanceof Error ? e.message : String(e)})`)
        return null
      }
    }),
  )
  const set = loadStopFiles(Object.fromEntries(loaded.filter((x): x is [string, unknown] => x !== null)))
  return { stops: set.stops, errors: [...loadErrors, ...set.errors] }
}

let livePromise: Promise<StopSet> | null = null
let liveCache: StopSet | null = null

/** The real stop content, loaded once. */
export function liveStops(): Promise<StopSet> {
  livePromise ??= loadLiveStops().then((set) => (liveCache = set))
  return livePromise
}

export interface StopSetResult {
  set: StopSet
  /** True while content comes from the SYNTHETIC fixtures (DEMO mode). */
  synthetic: boolean
  /** True until the live files have loaded. */
  loading: boolean
}

const EMPTY: StopSet = { stops: {}, errors: [] }

/** Every stop for the current mode: real content/stops files live, the fixtures in DEMO mode. */
export function useStopSet(): StopSetResult {
  const demo = useMission((s) => s.demo)
  const [live, setLive] = useState<StopSet | null>(liveCache)
  useEffect(() => {
    if (demo || live) return
    let active = true
    void liveStops().then((set) => {
      if (active) setLive(set)
    })
    return () => {
      active = false
    }
  }, [demo, live])
  return useMemo(
    () =>
      demo
        ? { set: fixtureStops(), synthetic: true, loading: false }
        : { set: live ?? EMPTY, synthetic: false, loading: live === null },
    [demo, live],
  )
}

export interface StopContentResult {
  content: StopContent | null
  /** True while content comes from the SYNTHETIC fixtures. */
  synthetic: boolean
  /** True until the live files have loaded. */
  loading: boolean
  errors: string[]
}

/** Stop content for one id: real content live, SYNTHETIC fixtures in DEMO mode. */
export function useStopContent(id: string | null | undefined): StopContentResult {
  const { set, synthetic, loading } = useStopSet()
  return useMemo(
    () => ({ content: id ? (set.stops[id] ?? null) : null, synthetic, loading, errors: set.errors }),
    [id, set, synthetic, loading],
  )
}
