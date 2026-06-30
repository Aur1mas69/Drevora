import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'

function DriverLoginPage() {
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
      description="Driver login"
      onBack={() => navigate('/')}
      onSignInSuccess={(session) => {
        setAuthenticatedSession(session)
        navigate('/dashboard', { replace: true })
      }}
    />
  )
}

export default DriverLoginPage
