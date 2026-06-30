import AppRouter from '@/router/AppRouter'
import { SupabaseConfigNotice } from '@/components/SupabaseConfigNotice'

function App() {
  return (
    <>
      <SupabaseConfigNotice />
      <AppRouter />
    </>
  )
}

export default App
