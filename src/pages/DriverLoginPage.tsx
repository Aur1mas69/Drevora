import { useNavigate } from 'react-router-dom'
import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'
import { useRoleBasedAuthRedirect } from '@/hooks/useRoleBasedAuthRedirect'

function DriverLoginPage() {
  const navigate = useNavigate()
  const { setAuthenticatedSession } = useAuth()
  useRoleBasedAuthRedirect()

  return (
    <LoginPageContent
      title="DREVORA"
      description="Driver login"
      onBack={() => navigate('/login', { replace: true })}
      onSignInSuccess={(session) => {
        // Portal is presentation preference only; shell is chosen by membership role.
        setAuthenticatedSession(session, 'worker')
      }}
    />
  )
}

export default DriverLoginPage
