// Imported first: records whether the last session crashed before the store restores the saved tab.
import { crashedLastSession, finishBoot } from './lib/boot'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { toast } from './store/toasts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

/** How long the app must stay up after the first render before the boot counts as finished. */
const BOOT_SETTLE_MS = 1500

window.setTimeout(() => {
  finishBoot()
  if (crashedLastSession) toast({ message: 'The last session closed unexpectedly, so we opened Define', tone: 'info' })
}, BOOT_SETTLE_MS)
