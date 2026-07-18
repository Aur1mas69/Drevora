import LoginPageContent from '@/components/LoginPage'
import { useAuth } from '@/contexts/AuthContext'
import { useRoleBasedAuthRedirect } from '@/hooks/useRoleBasedAuthRedirect'

function AdminLoginPage() {
  const { setAuthenticatedSession } = useAuth()
  useRoleBasedAuthRedirect()

  return (
    <LoginPageContent
      title="DREVORA"
      description="Admin login"
      backHref="https://drevora.app"
      onSignInSuccess={(session) => {
        // Portal is presentation preference only; shell is chosen by membership role.
        setAuthenticatedSession(session, 'admin')
      }}
    />
  )
}

export default AdminLoginPage
