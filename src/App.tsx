import AppRouter from '@/router/AppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'
import { startOfflineVehicleChecksAutoSync } from '@/services/offlineVehicleChecksService'
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    // Web/PWA: sync pending offline Vehicle Checks on launch and when connectivity returns.
    void startOfflineVehicleChecksAutoSync()
  }, [])

  return (
    <>
      <SupabaseConfigNotice />
      <PwaRuntime />
      <AppRouter />
    </>
  )
}

export default App
