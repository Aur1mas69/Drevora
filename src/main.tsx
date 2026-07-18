import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanySettingsProvider } from '@/contexts/CompanySettingsContext'
import './index.css'

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
