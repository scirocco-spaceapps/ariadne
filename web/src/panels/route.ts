// Pure helpers for the route sheet: one row per leg with the EVA clock and budget at arrival.
import type { Budget } from '../app/store'
import type { Aoi, RouteResponse } from '../lib/types'

export interface LegRow {
  leg: number
  from: string
  to: string
  distance_m: number
  time_min: number
  climb_m: number
  max_slope_deg: number
  /** EVA clock when the leg ends (arrival at `to`). */
  arrive_t: number
  /** EVA clock when the dwell at `to` ends; equals arrive_t when there is no dwell. */
  depart_t: number
  /** budget_min - arrive_t, or null without a budget. */
  budget_left: number | null
  belowReserve: boolean
}

/** Rows in leg order, timed from the route timeline (falls back to summed leg times). */
export function legRows(route: RouteResponse, budget: Budget | null): LegRow[] {
  let clock = 0
  return route.legs.map((leg, i) => {
    const walk = route.timeline.find((t) => t.kind === 'walk' && t.leg === i)
    const arrive = walk ? walk.t1_min : clock + leg.time_min
    const idx = walk ? route.timeline.indexOf(walk) : -1
    const next = idx >= 0 ? route.timeline[idx + 1] : undefined
    const depart = next && next.kind === 'dwell' && next.stop === leg.to ? next.t1_min : arrive
    clock = depart
    const left = budget ? budget.budget_min - arrive : null
    return {
      leg: i,
      from: leg.from,
      to: leg.to,
      distance_m: leg.distance_m,
      time_min: leg.time_min,
      climb_m: leg.climb_m,
      max_slope_deg: leg.max_slope_deg,
      arrive_t: arrive,
      depart_t: depart,
      budget_left: left,
      belowReserve: budget !== null && left !== null && left < budget.reserve_min,
    }
  })
}

/** Display name of a stop or the safe haven id; unknown ids are shown as they are. */
export function placeName(aoi: Aoi | null, id: string): string {
  if (!aoi) return id
  if (aoi.safe_haven.id === id) return aoi.safe_haven.name ?? id
  return aoi.stops.find((s) => s.id === id)?.name ?? id
}

/** EVA clock as "T+ h:mm" from minutes. */
export function evaClock(min: number): string {
  const m = Math.max(0, Math.round(min))
  return `T+ ${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
}
