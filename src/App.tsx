import AppRouter from '@/router/AppRouter'
import { PwaRuntime } from '@/components/pwa/PwaRuntime'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'

function App() {
  return (
    <>
      <SupabaseConfigNotice />
      <PwaRuntime />
      <AppRouter />
    </>
  )
}

export default App
