import ComingSoonPage from '@/components/ComingSoonPage'
import WorkEntryPage from '@/components/WorkEntryPage'
import { useAuth } from '@/contexts/AuthContext'

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <WorkEntryPage />
  }

  return <ComingSoonPage />
}

function App() {
  return <AppRoutes />
}

export default App
