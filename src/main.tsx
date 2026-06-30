import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from '@/contexts/AuthContext'
import { CompanySettingsProvider } from '@/contexts/CompanySettingsContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <CompanySettingsProvider>
        <App />
      </CompanySettingsProvider>
    </AuthProvider>
  </StrictMode>,
)
