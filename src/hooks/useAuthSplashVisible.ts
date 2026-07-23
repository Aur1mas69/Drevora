import { useEffect, useRef, useState } from 'react'
import {
  useMembershipAccessState,
  type MembershipAccessState,
} from '@/components/auth/MembershipAccessGate'

/** Short hold so a resolved session cannot flash login for a single frame. */
const MIN_SPLASH_MS = 320

function shouldHoldSplash(status: MembershipAccessState['status']): boolean {
  return (
    status === 'loading' ||
    status === 'office' ||
    status === 'worker' ||
    status === 'unlinked'
  )
}

/**
 * True while auth/membership is unresolved, or while an authenticated user is
 * about to be redirected away from a login route.
 * Includes a tiny minimum display time to avoid flicker — not a forced intro.
 */
export function useAuthSplashVisible(): boolean {
  const access = useMembershipAccessState()
  const hold = shouldHoldSplash(access.status)
  const [minHold, setMinHold] = useState(true)
  const shownAtRef = useRef(
    typeof performance !== 'undefined' ? performance.now() : Date.now(),
  )

  useEffect(() => {
    if (hold) {
      shownAtRef.current =
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      setMinHold(true)
      return
    }

    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now()
    const elapsed = now - shownAtRef.current
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed)
    const timer = window.setTimeout(() => setMinHold(false), remaining)
    return () => window.clearTimeout(timer)
  }, [hold])

  return hold || minHold
}
