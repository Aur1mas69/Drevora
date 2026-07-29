import WorkerAppRouter from '@/router/WorkerAppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'

/**
 * Capacitor native application shell — Worker routes only.
 * Resolved via the `@/App` Vite alias when `mode === 'native'`.
 */
function App() {
  return (
    <>
      <SupabaseConfigNotice />
      <PwaRuntime />
      <WorkerAppRouter />
    </>
  )
}

export default App
