import { useNavigate } from 'react-router-dom'
import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'
import { useRoleBasedAuthRedirect } from '@/hooks/useRoleBasedAuthRedirect'

function LoginPage() {
  const navigate = useNavigate()
  const { setAuthenticatedSession } = useAuth()
  useRoleBasedAuthRedirect()

  return (
    <LoginPageContent
      onBack={() => navigate('/login', { replace: true })}
      onSignInSuccess={(session) => {
        // Portal is presentation preference only; shell is chosen by membership role.
        setAuthenticatedSession(session, 'admin')
      }}
    />
  )
}

export default LoginPage
