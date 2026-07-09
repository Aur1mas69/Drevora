import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'

export default function WorkerLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, setAuthenticatedSession } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <LoginPageContent
      title="DREVORA"
      description="Worker login"
      onBack={() => navigate('/login', { replace: true })}
      onSignInSuccess={(session) => {
        setAuthenticatedSession(session, 'worker')
        navigate('/dashboard', { replace: true })
      }}
    />
  )
}
