import { Route, Routes } from 'react-router-dom'
import { CuffPlaceholder } from '../cuff'
import { ConsolePlaceholder } from '../panels'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ConsolePlaceholder />} />
      <Route path="/cuff" element={<CuffPlaceholder />} />
    </Routes>
  )
}
