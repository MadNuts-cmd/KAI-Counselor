import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { backendClient } from './services/backendClient'
import { audioManager } from './services/audioManager'

// Attach for runtime inspection & QA validation
(window as any).__kaiBackend = backendClient;
(window as any).__kaiAudio = audioManager;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
