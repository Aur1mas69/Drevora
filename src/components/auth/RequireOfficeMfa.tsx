import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import { MembershipAccessBlocked } from '@/components/auth/MembershipAccessGate'
import { OfficeMfaChallengeScreen } from '@/components/auth/OfficeMfaChallengeScreen'
import { OfficeMfaEnrollScreen } from '@/components/auth/OfficeMfaEnrollScreen'
import { useOfficeMfaGate } from '@/hooks/useOfficeMfaGate'
import type { ReactNode } from 'react'

/**
 * Blocks usable Office/Admin UI until the session reaches AAL2 with a verified
 * TOTP factor. Must only wrap routes after Office membership is confirmed.
 * Drivers never enter this gate.
 */
export function RequireOfficeMfa({ children }: { children: ReactNode }) {
  const { decision, factors, error, refresh } = useOfficeMfaGate(true)

  if (error) {
    return (
      <MembershipAccessBlocked
        title="Two-factor authentication"
        message={error}
      />
    )
  }

  if (decision.action === 'loading') {
    return <AuthSplashScreen />
  }

  if (decision.action === 'enroll') {
    return <OfficeMfaEnrollScreen onCompleted={refresh} />
  }

  if (decision.action === 'challenge') {
    return (
      <OfficeMfaChallengeScreen factors={factors} onCompleted={refresh} />
    )
  }

  return <>{children}</>
}
