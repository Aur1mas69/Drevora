import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useMembershipAccessState } from '@/components/auth/MembershipAccessGate'
import { OFFICE_HOME_PATH, WORKER_HOME_PATH } from '@/lib/membershipRoles'

/**
 * After auth + membership resolve, send the user to the correct shell by
 * verified company_members.role. Ignores sessionStorage portal.
 */
export function useRoleBasedAuthRedirect(): void {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const access = useMembershipAccessState()

  useEffect(() => {
    if (!isAuthenticated || access.status === 'loading') {
      return
    }

    if (access.status === 'office') {
      navigate(OFFICE_HOME_PATH, { replace: true })
      return
    }

    if (access.status === 'worker') {
      navigate(WORKER_HOME_PATH, { replace: true })
    }
  }, [access.status, isAuthenticated, navigate])
}
