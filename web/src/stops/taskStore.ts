// Task ticks on stop cards. In memory only: not persisted, not synced between screens.
import { create } from 'zustand'

export interface StopTasksStore {
  /** Ticked task indices per stop id. */
  ticks: Record<string, number[]>
  toggle: (stopId: string, index: number) => void
  reset: () => void
}

export const useStopTasks = create<StopTasksStore>()((set) => ({
  ticks: {},
  toggle: (stopId, index) =>
    set((s) => {
      const cur = s.ticks[stopId] ?? []
      const next = cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index].sort((a, b) => a - b)
      return { ticks: { ...s.ticks, [stopId]: next } }
    }),
  reset: () => set({ ticks: {} }),
}))

/** True when task `index` of `stopId` is ticked. */
export function isTicked(ticks: StopTasksStore['ticks'], stopId: string, index: number): boolean {
  return ticks[stopId]?.includes(index) ?? false
}
