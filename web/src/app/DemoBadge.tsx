import { useMission } from './store'

/** Always visible in DEMO mode: the data on screen is SYNTHETIC, never real. */
export function DemoBadge() {
  const demo = useMission((s) => s.demo)
  if (!demo) return null
  return (
    <div
      role="status"
      title="SYNTHETIC fixtures, not real data"
      style={{
        position: 'fixed',
        top: 8,
        right: 8,
        zIndex: 1000,
        padding: '4px 10px',
        borderRadius: 4,
        background: '#f2a93b',
        color: '#1a1208',
        font: '600 13px/1.4 system-ui, sans-serif',
        letterSpacing: '0.06em',
      }}
    >
      DEMO DATA
    </div>
  )
}
