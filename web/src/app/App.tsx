import { Route, Routes, useLocation } from 'react-router-dom'
import { CuffPlaceholder } from '../cuff'
import { ConsolePlaceholder } from '../panels'
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
        <Route path="/cuff" element={<CuffPlaceholder />} />
      </Routes>
    </>
  )
}
