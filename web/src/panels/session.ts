// Pure helpers for the session bar: the create-session body, time to storm, keyboard shortcuts.
import type { Budget } from '../app/store'
import type { Aoi, RouteResponse, SessionCreate, WsState } from '../lib/types'

/** Simulated minutes per real second the operator can pick; 6 is the contract default. */
export const SPEEDS = [1, 3, 6, 12] as const
export const DEFAULT_SPEED = 6

/** Storm lead times the operator can send (scenario input, not a forecast). */
export const LEAD_TIMES = [15, 25, 30] as const
export const DEFAULT_LEAD = 30

/** POST /sessions body: the route plus budget, reserve and dwell from the store and the AOI model. */
export function sessionBody(route: RouteResponse, budget: Budget | null, aoi: Aoi): SessionCreate {
  const b = budget ?? { budget_min: aoi.model.budget_min, reserve_min: aoi.model.reserve_min }
  return { route, budget_min: b.budget_min, reserve_min: b.reserve_min, dwell_min: aoi.model.dwell_min }
}

/** Minutes until the storm arrives, never below zero; null without an alert. */
export function timeToStorm(state: WsState | null): number | null {
  if (!state?.alert) return null
  return Math.max(0, state.alert.lead_min - (state.t_min - state.alert.since_t))
}

/** Minutes as "m:ss". */
export function minSec(min: number): string {
  const total = Math.max(0, Math.round(min * 60))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Minutes as the EVA clock "T+ h:mm". */
export function evaClock(min: number): string {
  const m = Math.max(0, Math.floor(min))
  return `T+ ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}

export type Shortcut = 'start' | 'alert' | 'clear'

/** S, A, C for the demo; nothing while typing in a field or with a modifier held. */
export function shortcutFor(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey' | 'target'>): Shortcut | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName))) return null
  switch (e.key.toLowerCase()) {
    case 's':
      return 'start'
    case 'a':
      return 'alert'
    case 'c':
      return 'clear'
    default:
      return null
  }
}
