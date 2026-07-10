import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanySettingsProvider } from '@/contexts/CompanySettingsContext'
import './index.css'

async function clearStaleServiceWorkers() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map((registration) => registration.unregister()))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <AuthProvider>
        <CompanySettingsProvider>
          <App />
        </CompanySettingsProvider>
      </AuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
)

// Cache cleanup must never delay React startup or touch responsiveness.
void clearStaleServiceWorkers().catch(() => {
  // A failed cleanup is non-fatal; the application is already mounted.
})
