import { useMission } from '../app/store'

export function ConsolePlaceholder() {
  const status = useMission((s) => s.session.status)
  const state = useMission((s) => s.session.state)
  return (
    <main>
      <h1>Ariadne mission console</h1>
      <p>Placeholder. Map, route, timeline and conditions go here.</p>
      <p data-testid="session-line">
        Session: {status}
        {state && <> · T+{state.t_min.toFixed(1)} min · pos {state.pos.map((v) => v.toFixed(0)).join(', ')} m ({state.provenance})</>}
      </p>
    </main>
  )
}
