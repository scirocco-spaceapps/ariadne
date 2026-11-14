// Pure helpers for the conditions panel: labels, formatting and the state of each part.
import type { Conditions } from '../lib/types'

export type PartKey = 'weather' | 'radiation' | 'space_weather' | 'partner'

export const PART_TITLE: Record<PartKey, string> = {
  weather: 'Weather',
  radiation: 'Radiation',
  space_weather: 'Space weather',
  partner: 'Partner agency',
}

const VALUE_LABEL: Record<string, string> = {
  air_temp_min: 'Air temp min',
  air_temp_max: 'Air temp max',
  pressure: 'Pressure',
  dust_opacity: 'Dust opacity',
}

/** Human label for a weather value key; unknown keys are shown as they come. */
export function valueLabel(key: string): string {
  return VALUE_LABEL[key] ?? key
}

/** A number for the panel: up to 2 decimals, no trailing zeros; null → "—". */
export function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  return String(Math.round(v * 100) / 100)
}

/** Units that read better without a space ("degC" → "°C"). */
export function formatUnit(unit: string | undefined): string {
  if (!unit) return ''
  if (unit === 'degC') return '°C'
  if (unit === 'degK' || unit === 'K') return 'K'
  return unit
}

/** "2026-11-14T10:30:00Z" → "2026-11-14 10:30 UTC"; anything unparsable is returned as is. */
export function formatUtc(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
}

export type PartState = { present: true } | { present: false; reason: string }

/** Whether a part is there, and if not, the reason the service gave (or a generic one). */
export function partState(c: Conditions, part: PartKey): PartState {
  if (c[part] !== null && c[part] !== undefined) return { present: true }
  return { present: false, reason: c.missing?.[part] ?? 'The service did not say why.' }
}
