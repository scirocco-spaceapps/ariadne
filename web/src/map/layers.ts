// Layer registry: every map layer registers here so LayerToggle can list and switch it.

import { create } from 'zustand'
import type { Provenance } from '../lib/types'

export type LayerEntry = {
  id: string
  label: string
  provenance: Provenance
  visible: boolean
}

type LayerRegistry = {
  layers: LayerEntry[]
  /** Adds a layer, or updates label/provenance of an existing one (keeping its visibility). */
  register: (entry: LayerEntry) => void
  unregister: (id: string) => void
  setVisible: (id: string, visible: boolean) => void
}

export const useLayerRegistry = create<LayerRegistry>((set) => ({
  layers: [],
  register: (entry) =>
    set((s) => {
      const existing = s.layers.find((l) => l.id === entry.id)
      if (!existing) return { layers: [...s.layers, entry] }
      return {
        layers: s.layers.map((l) =>
          l.id === entry.id ? { ...entry, visible: existing.visible } : l,
        ),
      }
    }),
  unregister: (id) => set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),
  setVisible: (id, visible) =>
    set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible } : l)) })),
}))

/** Visibility of one layer; false until it is registered. */
export function useLayerVisible(id: string): boolean {
  return useLayerRegistry((s) => s.layers.find((l) => l.id === id)?.visible ?? false)
}
