import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  isOfficeMembershipRole,
  isWorkerMembershipRole,
} from '@/lib/membershipRoles'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

export type MembershipAccessState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'office' }
  | { status: 'worker' }
  | { status: 'blocked'; message: string }

const UNSUPPORTED_ROLE_MESSAGE =
  'Your account role is not supported for this application. Contact your manager or DREVORA support.'

const UNRESOLVED_MEMBERSHIP_MESSAGE =
  'Your company membership could not be verified. Contact your manager or DREVORA support.'

/**
 * Resolve shell access from verified company_members.role only.
 * Ignores sessionStorage portal / login URL.
 */
export function useMembershipAccessState(): MembershipAccessState {
  const { isAuthenticated, isAuthLoading } = useAuth()
  const {
    companyLoading,
    companyReady,
    membershipRole,
    membershipError,
  } = useCompanySettings()

  if (isAuthLoading || (isAuthenticated && companyLoading)) {
    return { status: 'loading' }
  }

  if (!isAuthenticated) {
    return { status: 'unauthenticated' }
  }

  if (membershipError) {
    return { status: 'blocked', message: membershipError }
  }

  if (!companyReady || !membershipRole) {
    return { status: 'blocked', message: UNRESOLVED_MEMBERSHIP_MESSAGE }
  }

  if (isOfficeMembershipRole(membershipRole)) {
    return { status: 'office' }
  }

  if (isWorkerMembershipRole(membershipRole)) {
    return { status: 'worker' }
  }

  return { status: 'blocked', message: UNSUPPORTED_ROLE_MESSAGE }
}

/** Neutral full-viewport placeholder — no Office or Worker chrome. */
export function MembershipLoadingScreen() {
  return (
    <div
      className="min-h-dvh bg-[#F6F9FF]"
      aria-label="Loading account"
      role="status"
    />
  )
}

/** Fail-closed screen without Office/Worker application chrome. */
export function MembershipAccessBlocked({ message }: { message: string }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [isSigningOut, setIsSigningOut] = useState(false)

  async function handleSignOut() {
    setIsSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F6F9FF] px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">Account access</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <Button
          type="button"
          className="mt-5 w-full"
          disabled={isSigningOut}
          onClick={() => void handleSignOut()}
        >
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </div>
  )
}
