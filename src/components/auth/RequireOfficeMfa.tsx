import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import { MembershipAccessBlocked } from '@/components/auth/MembershipAccessGate'
import { OfficeMfaChallengeScreen } from '@/components/auth/OfficeMfaChallengeScreen'
import { OfficeMfaEnrollScreen } from '@/components/auth/OfficeMfaEnrollScreen'
import { useOfficeMfaGate } from '@/hooks/useOfficeMfaGate'
import type { ReactNode } from 'react'
import { resumeOwnOfficeMfa } from '@/services/mfaService'

/**
 * Office MFA gate. Pause (mfa_enabled false) allows AAL1 even with a saved
 * authenticator. Challenge only when enforcement is on and the session is AAL1.
 * Enroll is repair-only: enforcement on with no verified factor.
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

  if (decision.action === 'challenge') {
    return (
      <OfficeMfaChallengeScreen factors={factors} onCompleted={refresh} />
    )
  }

  if (decision.action === 'enroll') {
    return (
      <OfficeMfaEnrollScreen
        onCompleted={async () => {
          try {
            await resumeOwnOfficeMfa()
          } catch {
            // Repair path: mfa_enabled is already true. Refresh either way.
          }
          await refresh()
        }}
      />
    )
  }

  return <>{children}</>
}
