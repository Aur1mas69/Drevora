import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'

function LoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, setAuthenticatedSession } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <LoginPageContent
      onBack={() => navigate('/login', { replace: true })}
      onSignInSuccess={(session) => {
        setAuthenticatedSession(session, 'admin')
        navigate('/admin', { replace: true })
      }}
    />
  )
}

export default LoginPage
