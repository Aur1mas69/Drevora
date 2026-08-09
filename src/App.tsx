import AppRouter from '@/router/AppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'
import { startOfflineVehicleChecksAutoSync } from '@/services/offlineVehicleChecksService'
import { SpeedInsights } from '@vercel/speed-insights/react'
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
      <SpeedInsights />
    </>
  )
}

export default App
