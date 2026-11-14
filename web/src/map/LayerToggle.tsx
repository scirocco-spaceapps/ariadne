// Lists every registered map layer with a visibility checkbox and its provenance.

import { useLayerRegistry } from './layers'
import './map.css'

export function LayerToggle() {
  const layers = useLayerRegistry((s) => s.layers)
  const setVisible = useLayerRegistry((s) => s.setVisible)

  if (layers.length === 0) return <p className="am-toggle-empty">No map layers yet.</p>

  return (
    <fieldset className="am-toggle">
      <legend>Layers</legend>
      {layers.map((l) => (
        <label key={l.id} className="am-toggle-row" htmlFor={`layer-${l.id}`}>
          <input
            id={`layer-${l.id}`}
            type="checkbox"
            checked={l.visible}
            onChange={(e) => setVisible(l.id, e.target.checked)}
          />
          <span className="am-toggle-label">{l.label}</span>
          <span className={`am-prov am-prov-${l.provenance.toLowerCase()}`}>{l.provenance}</span>
        </label>
      ))}
    </fieldset>
  )
}
