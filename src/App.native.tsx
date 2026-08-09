import WorkerAppRouter from '@/router/WorkerAppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'
import { AppLockProvider } from '@/contexts/AppLockContext'
import { startOfflineVehicleChecksAutoSync } from '@/services/offlineVehicleChecksService'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'

/**
 * Native platform markers for iOS-only Worker Home density CSS.
 * Set synchronously at module load (not in an effect) so first paint already
 * has the correct scoping — avoids a flash of the wider web/PWA spacing.
 */
if (typeof document !== 'undefined') {
  const platform = Capacitor.getPlatform()
  document.documentElement.classList.add('drevora-native', `drevora-${platform}`)
}

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
