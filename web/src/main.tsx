import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app'
import './app/fonts'
import './app/theme.css'

// Under automation (e2e on a CI runner without a GPU) heavy visual effects are switched off in CSS.
if (navigator.webdriver) document.documentElement.dataset.automation = '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
