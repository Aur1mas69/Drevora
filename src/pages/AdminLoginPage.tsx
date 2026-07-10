import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'

function AdminLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, setAuthenticatedSession } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin', { replace: true })
    }
  }, [isAuthenticated, navigate])

  return (
    <LoginPageContent
      title="DREVORA"
      description="Admin login"
      backHref="https://drevora.app"
      onSignInSuccess={(session) => {
        setAuthenticatedSession(session, 'admin')
        navigate('/admin', { replace: true })
      }}
    />
  )
}

export default AdminLoginPage
