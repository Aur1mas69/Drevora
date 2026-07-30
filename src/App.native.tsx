import WorkerAppRouter from '@/router/WorkerAppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'
import { AppLockProvider } from '@/contexts/AppLockContext'
import { startOfflineVehicleChecksAutoSync } from '@/services/offlineVehicleChecksService'
import { useEffect } from 'react'

/**
 * Capacitor native application shell — Worker routes only.
 * Resolved via the `@/App` Vite alias when `mode === 'native'`.
 */
function App() {
  useEffect(() => {
    void startOfflineVehicleChecksAutoSync()
  }, [])

  return (
    <AppLockProvider>
      <SupabaseConfigNotice />
      <PwaRuntime />
      <WorkerAppRouter />
    </AppLockProvider>
  )
}

export default App
