import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SetupDashboard from './SetupDashboard.jsx'

const isSetup = window.location.pathname.startsWith('/setup')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSetup ? <SetupDashboard /> : <App />}
  </StrictMode>,
)
