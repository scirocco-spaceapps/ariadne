// Lists every registered map layer, top layer first, with a visibility checkbox, its provenance
// and, while it is on, its colour legend.

import { useLayerRegistry } from './layers'
import './map.css'

export function LayerToggle() {
  const layers = useLayerRegistry((s) => s.layers)
  const setVisible = useLayerRegistry((s) => s.setVisible)

  if (layers.length === 0) return <p className="am-toggle-empty">No map layers yet.</p>

  return (
    <fieldset className="am-toggle">
      <legend>Layers</legend>
      {[...layers].reverse().map((l) => (
        <div key={l.id} className="am-toggle-item">
          <label className="am-toggle-row" htmlFor={`layer-${l.id}`}>
            <input
              id={`layer-${l.id}`}
              type="checkbox"
              checked={l.visible}
              onChange={(e) => setVisible(l.id, e.target.checked)}
            />
            <span className="am-toggle-label">{l.label}</span>
            <span className={`am-prov am-prov-${l.provenance.toLowerCase()}`}>{l.provenance}</span>
          </label>
          {l.visible && l.legend && l.legend.length > 0 && (
            <ul className="am-legend" aria-label={`${l.label} legend`}>
              {l.legend.map((item) => (
                <li key={item.label}>
                  <span className="am-swatch" style={{ background: item.color }} />
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </fieldset>
  )
}
