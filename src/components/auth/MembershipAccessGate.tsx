import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  isOfficeMembershipRole,
  isWorkerMembershipRole,
} from '@/lib/membershipRoles'
import {
  fetchOwnActiveAccountDeletionRequest,
  formatAccountDeletionScheduledMessage,
} from '@/services/accountDeletionService'
import { NO_ACTIVE_MEMBERSHIP_MESSAGE } from '@/services/companyMembershipService'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

export type MembershipAccessState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'office' }
  | { status: 'worker' }
  | { status: 'unlinked' }
  | { status: 'deletion_scheduled'; scheduledFor: string }
  | { status: 'blocked'; message: string }

const UNSUPPORTED_ROLE_MESSAGE =
  'Your account role is not supported for this application. Contact your manager or DREVORA support.'

const UNRESOLVED_MEMBERSHIP_MESSAGE =
  'Your company membership could not be verified. Contact your manager or DREVORA support.'

/**
 * Resolve shell access from verified company_members.role only.
 * Ignores sessionStorage portal / login URL.
 *
 * Pending/processing account deletion is a dedicated state — never treated as
 * unlinked (which would send the user to company onboarding).
 */
export function useMembershipAccessState(): MembershipAccessState {
  const { isAuthenticated, isAuthLoading, session } = useAuth()
  const {
    companyLoading,
    companyReady,
    membershipRole,
    membershipError,
  } = useCompanySettings()
  const [deletionLookup, setDeletionLookup] = useState<{
    loading: boolean
    scheduledFor: string | null
  }>({ loading: true, scheduledFor: null })

  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) {
      setDeletionLookup({ loading: false, scheduledFor: null })
      return
    }

    let cancelled = false
    setDeletionLookup({ loading: true, scheduledFor: null })

    void fetchOwnActiveAccountDeletionRequest()
      .then((row) => {
        if (cancelled) return
        setDeletionLookup({
          loading: false,
          scheduledFor: row?.scheduledFor ?? null,
        })
      })
      .catch(() => {
        if (cancelled) return
        // Fail closed to membership resolution; do not invent a deletion state.
        setDeletionLookup({ loading: false, scheduledFor: null })
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isAuthLoading, session?.user.id])

  if (isAuthLoading || (isAuthenticated && (companyLoading || deletionLookup.loading))) {
    return { status: 'loading' }
  }

  if (!isAuthenticated) {
    return { status: 'unauthenticated' }
  }

  if (deletionLookup.scheduledFor) {
    return {
      status: 'deletion_scheduled',
      scheduledFor: deletionLookup.scheduledFor,
    }
  }

  if (membershipError === NO_ACTIVE_MEMBERSHIP_MESSAGE) {
    return { status: 'unlinked' }
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

/** Full-viewport auth splash — no Office or Worker chrome. */
export function MembershipLoadingScreen() {
  return <AuthSplashScreen />
}

/** Fail-closed screen without Office/Worker application chrome. */
export function MembershipAccessBlocked({
  title = 'Account access',
  message,
}: {
  title?: string
  message: string
}) {
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
        <h1 className="text-lg font-semibold text-slate-950">{title}</h1>
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

/** Dedicated blocked UI for pending/processing account deletion. */
export function AccountDeletionScheduledBlocked({
  scheduledFor,
}: {
  scheduledFor: string
}) {
  return (
    <MembershipAccessBlocked
      title="Account deletion scheduled"
      message={formatAccountDeletionScheduledMessage(scheduledFor)}
    />
  )
}
