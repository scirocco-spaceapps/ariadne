import { Route, Routes, useLocation } from 'react-router-dom'
import { Cuff } from '../cuff'
import { Console } from '../panels'
import { DevStopsPage } from '../stops'
import { useMissionBootstrap, useSessionRecovery, useSessionSocket } from './bootstrap'
import { DemoBadge } from './DemoBadge'
import { Intro } from './Intro'
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
      {/* First-load title card on the console only (Intro.tsx): never blocks, once per tab. */}
      {pathname === '/' && <Intro />}
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
