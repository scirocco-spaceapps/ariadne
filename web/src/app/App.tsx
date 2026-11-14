import { Route, Routes, useLocation } from 'react-router-dom'
import { Cuff } from '../cuff'
import { Console } from '../panels'
import { DevStopsPage } from '../stops'
import { useMissionBootstrap, useSessionRecovery, useSessionSocket } from './bootstrap'
import { DemoBadge } from './DemoBadge'
import { LinkBanner } from './LinkBanner'

export function App() {
  const { pathname, search } = useLocation()
  const role = pathname.startsWith('/cuff') ? 'cuff' : 'console'
  useMissionBootstrap(search)
  useSessionSocket(role)
  useSessionRecovery(role)
  return (
    <>
      {/* The cuff shows its DEMO DATA badge in its own header, so the layout does not move. */}
      {role === 'console' && <DemoBadge />}
      <LinkBanner role={role} />
      <Routes>
        <Route path="/" element={<Console />} />
        <Route path="/cuff" element={<Cuff />} />
        {/* Furkan's stop-card check page: every fixture stop in both variants. */}
        <Route path="/dev/stops" element={<DevStopsPage />} />
      </Routes>
    </>
  )
}
