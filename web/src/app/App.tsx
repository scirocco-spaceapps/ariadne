import { Route, Routes, useLocation } from 'react-router-dom'
import { Cuff } from '../cuff'
import { ConsolePlaceholder } from '../panels'
import { DevStopsPage } from '../stops'
import { useMissionBootstrap, useSessionSocket } from './bootstrap'
import { DemoBadge } from './DemoBadge'

export function App() {
  const { pathname, search } = useLocation()
  useMissionBootstrap(search)
  useSessionSocket(pathname.startsWith('/cuff') ? 'cuff' : 'console')
  return (
    <>
      <DemoBadge />
      <Routes>
        <Route path="/" element={<ConsolePlaceholder />} />
        <Route path="/cuff" element={<Cuff />} />
        {/* Furkan's stop-card check page: every fixture stop in both variants. */}
        <Route path="/dev/stops" element={<DevStopsPage />} />
      </Routes>
    </>
  )
}
