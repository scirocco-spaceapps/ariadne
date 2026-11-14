// Layer registry: every map layer registers here so LayerToggle can list and switch it.

import { create } from 'zustand'
import type { Provenance } from '../lib/types'

export type LegendItem = { color: string; label: string }

export type LayerEntry = {
  id: string
  label: string
  provenance: Provenance
  visible: boolean
  /** Stacking order, bottom = 0. LayerToggle lists the top layer first. */
  order?: number
  /** Colour key shown under the toggle while the layer is visible. */
  legend?: LegendItem[]
}

type LayerRegistry = {
  layers: LayerEntry[]
  /** Adds a layer, or updates an existing one while keeping its visibility. */
  register: (entry: LayerEntry) => void
  unregister: (id: string) => void
  setVisible: (id: string, visible: boolean) => void
}

const byOrder = (a: LayerEntry, b: LayerEntry) => (a.order ?? 0) - (b.order ?? 0)

export const useLayerRegistry = create<LayerRegistry>((set) => ({
  layers: [],
  register: (entry) =>
    set((s) => {
      const existing = s.layers.find((l) => l.id === entry.id)
      const next = existing
        ? s.layers.map((l) => (l.id === entry.id ? { ...entry, visible: existing.visible } : l))
        : [...s.layers, entry]
      return { layers: next.sort(byOrder) }
    }),
  unregister: (id) => set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),
  setVisible: (id, visible) =>
    set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible } : l)) })),
}))

/** Visibility of one layer; false until it is registered. */
export function useLayerVisible(id: string): boolean {
  return useLayerRegistry((s) => s.layers.find((l) => l.id === id)?.visible ?? false)
}
