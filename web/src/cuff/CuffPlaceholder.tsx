import { useMission } from '../app/store'

export function CuffPlaceholder() {
  const status = useMission((s) => s.session.status)
  const state = useMission((s) => s.session.state)
  return (
    <main>
      <h1>Ariadne cuff</h1>
      <p>Placeholder. Time to home and next stop go here.</p>
      <p data-testid="session-line">
        Session: {status}
        {state && <> · T+{state.t_min.toFixed(1)} min · pos {state.pos.map((v) => v.toFixed(0)).join(', ')} m ({state.provenance})</>}
      </p>
    </main>
  )
}
