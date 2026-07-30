import WorkerAppRouter from '@/router/WorkerAppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'
import { AppLockProvider } from '@/contexts/AppLockContext'

/**
 * Capacitor native application shell — Worker routes only.
 * Resolved via the `@/App` Vite alias when `mode === 'native'`.
 */
function App() {
  return (
    <AppLockProvider>
      <SupabaseConfigNotice />
      <PwaRuntime />
      <WorkerAppRouter />
    </AppLockProvider>
  )
}

export default App
