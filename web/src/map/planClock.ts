// Plan time for the time bar in planning mode (a route, no session): minutes from EVA start.
// Kept in the map folder because the mission store has no planning-time field (see docs/notes/nuri.md).

import { create } from 'zustand'

type PlanClock = {
  t_min: number
  setT: (t_min: number) => void
}

export const usePlanClock = create<PlanClock>((set) => ({
  t_min: 0,
  setT: (t_min) => set({ t_min: Math.max(0, t_min) }),
}))
