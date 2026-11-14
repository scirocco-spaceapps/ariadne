import { describe, expect, it } from 'vitest'
import { fixtures } from '../lib/fixtures'
import { formatDistance, photoUrl, targetLine } from './format'
import { FIXTURE_LABEL, fixtureStops, loadStopFiles, parseStops } from './loader'
import { validateStopContent } from './validate'

/** A deep copy of the fixture stop s1, safe to mutate. */
function stop(): Record<string, unknown> {
  return structuredClone(fixtures.stops.find((s) => s.id === 's1')) as unknown as Record<string, unknown>
}

function photo0(s: Record<string, unknown>): Record<string, unknown> {
  return (s.photos as Record<string, unknown>[])[0]
}

function errorsOf(raw: unknown): string[] {
  return validateStopContent(raw).errors
}

describe('validateStopContent: valid content', () => {
  it('accepts every fixture entry (stop and target)', () => {
    for (const s of fixtures.stops) expect(validateStopContent(s)).toEqual({ ok: true, value: s, errors: [] })
  })

  it('accepts a photo without distance_m and content without draft', () => {
    const s = stop()
    delete photo0(s).distance_m
    delete s.draft
    expect(errorsOf(s)).toEqual([])
  })

  it('accepts no tasks and no photos', () => {
    const s = stop()
    s.tasks = []
    s.photos = []
    expect(errorsOf(s)).toEqual([])
  })
})

describe('validateStopContent: invalid content', () => {
  const cases: [string, (s: Record<string, unknown>) => void, RegExp][] = [
    ['missing required field', (s) => delete s.science_question, /science_question: required/],
    ['unknown top-level field', (s) => (s.extra = 1), /extra: unknown field/],
    ['bad kind', (s) => (s.kind = 'waypoint'), /kind: must be one of stop, target/],
    ['bad provenance', (s) => (s.provenance = 'Measured'), /provenance: must be one of/],
    ['empty name', (s) => (s.name = '  '), /name: must be a non-empty string/],
    ['tasks not an array', (s) => (s.tasks = 'look'), /tasks: must be an array/],
    ['empty task', (s) => (s.tasks = ['ok', '']), /tasks\[1\]: must be a non-empty string/],
    ['photos not an array', (s) => (s.photos = {}), /photos: must be an array/],
    ['photo missing page_url', (s) => delete photo0(s).page_url, /photos\[0\]\.page_url: required/],
    ['photo missing credit', (s) => delete photo0(s).credit, /photos\[0\]\.credit: required/],
    ['photo unknown field', (s) => (photo0(s).url = 'x'), /photos\[0\]\.url: unknown field/],
    ['negative sol', (s) => (photo0(s).sol = -1), /photos\[0\]\.sol: must be an integer >= 0/],
    ['fractional sol', (s) => (photo0(s).sol = 1.5), /photos\[0\]\.sol: must be an integer >= 0/],
    ['negative distance', (s) => (photo0(s).distance_m = -2), /photos\[0\]\.distance_m: must be a number >= 0/],
    ['absolute file', (s) => (photo0(s).file = '/photos/a.jpg'), /photos\[0\]\.file: must be a path relative/],
    ['file escaping content/', (s) => (photo0(s).file = '../secret.jpg'), /photos\[0\]\.file: must be a path relative/],
    ['file as URL', (s) => (photo0(s).file = 'https://x.org/a.jpg'), /photos\[0\]\.file: must be a path relative/],
    ['page_url not a URL', (s) => (photo0(s).page_url = 'not a url'), /photos\[0\]\.page_url: must be an http\(s\) URL/],
    ['page_url not http', (s) => (photo0(s).page_url = 'javascript:alert(1)'), /page_url: must be an http\(s\) URL/],
    ['photo not an object', (s) => (s.photos = ['a.jpg']), /photos\[0\]: must be an object/],
    ['no sources', (s) => (s.sources = []), /sources: needs at least one source/],
    ['missing sources', (s) => delete s.sources, /sources: required/],
    ['source without url', (s) => (s.sources = [{ title: 'x' }]), /sources\[0\]\.url: required/],
    ['source with bad url', (s) => (s.sources = [{ title: 'x', url: 'ftp://x' }]), /sources\[0\]\.url: must be/],
    ['draft not boolean', (s) => (s.draft = 'yes'), /draft: must be a boolean/],
  ]

  it.each(cases)('rejects %s', (_name, mutate, expected) => {
    const s = stop()
    mutate(s)
    const errors = errorsOf(s)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => expected.test(e))).toBe(true)
  })

  it.each([null, 42, 'stop', [1, 2]])('rejects non-object input %j', (raw) => {
    expect(errorsOf(raw)).toEqual(['stop content must be an object'])
  })

  it('prefixes errors with where they came from', () => {
    const s = stop()
    s.kind = 'x'
    const r = validateStopContent(s, 'content/stops/s1.json')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toMatch(/^content\/stops\/s1\.json: kind/)
  })
})

describe('parseStops', () => {
  it('loads both fixture entries without errors', () => {
    const set = fixtureStops()
    expect(set.errors).toEqual([])
    expect(Object.keys(set.stops).sort()).toEqual(['s1', 't1'])
    expect(set.stops.t1.kind).toBe('target')
  })

  it('keeps valid entries and reports invalid ones and duplicate ids', () => {
    const bad = stop()
    bad.id = 'bad'
    delete bad.unit
    const set = parseStops([stop(), bad, stop()], FIXTURE_LABEL)
    expect(Object.keys(set.stops)).toEqual(['s1'])
    expect(set.errors).toEqual([`${FIXTURE_LABEL}[1]: unit: required`, `${FIXTURE_LABEL}[2]: duplicate id "s1"`])
  })

  it('rejects a non-array', () => {
    expect(parseStops({}, 'x').errors).toEqual(['x: must be an array of stop content'])
  })
})

describe('loadStopFiles', () => {
  it('loads content/stops/<id>.json and skips index.json', () => {
    const set = loadStopFiles({
      '../../../content/stops/s1.json': stop(),
      '../../../content/stops/index.json': { stops: ['s1'] },
    })
    expect(set.errors).toEqual([])
    expect(Object.keys(set.stops)).toEqual(['s1'])
  })

  it('rejects a file whose id does not match its name', () => {
    const set = loadStopFiles({ 'content/stops/s2.json': stop() })
    expect(set.stops).toEqual({})
    expect(set.errors).toEqual(['content/stops/s2.json: id "s1" does not match the file name "s2"'])
  })

  it('reports invalid files with their path', () => {
    const s = stop()
    s.provenance = 'Guess'
    const set = loadStopFiles({ 'content/stops/s1.json': s })
    expect(set.stops).toEqual({})
    expect(set.errors[0]).toMatch(/^content\/stops\/s1\.json: provenance/)
  })
})

describe('format', () => {
  it('builds the target line from the first photo', () => {
    const t1 = fixtureStops().stops.t1
    expect(targetLine(t1)).toBe('Seen from 100 m on sol 1205, never visited')
  })

  it('has no target line for a stop or a target without photos', () => {
    expect(targetLine(fixtureStops().stops.s1)).toBeNull()
    expect(targetLine({ kind: 'target', photos: [] })).toBeNull()
  })

  it('omits the distance when it is unknown', () => {
    const p = { ...fixtureStops().stops.t1.photos[0], distance_m: undefined }
    expect(targetLine({ kind: 'target', photos: [p] })).toBe('Seen on sol 1205, never visited')
  })

  it('formats distances', () => {
    expect(formatDistance(3.46)).toBe('3.5')
    expect(formatDistance(10)).toBe('10')
    expect(formatDistance(123.6)).toBe('124')
  })

  it('resolves photo files under content/', () => {
    expect(photoUrl('photos/a.jpg')).toMatch(/content\/photos\/a\.jpg$/)
  })
})
