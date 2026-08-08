import { useCallback, useEffect, useState } from 'react'
import {
  OFFICE_MFA_FACTORS_CHANGED_EVENT,
  resolveOfficeMfaGate,
  type AuthenticatorAssuranceLevel,
  type OfficeMfaGateDecision,
  type OfficeMfaTotpFactor,
} from '@/lib/officeMfa'
import {
  getAuthenticatorAssuranceLevel,
  listTotpFactors,
  MfaServiceError,
} from '@/services/mfaService'

export type OfficeMfaGateState = {
  decision: OfficeMfaGateDecision
  factors: OfficeMfaTotpFactor[]
  aal: AuthenticatorAssuranceLevel | null
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Loads Supabase MFA assurance + TOTP factors for an Office membership.
 * Call only after company_members has confirmed an Office role.
 */
export function useOfficeMfaGate(enabled: boolean): OfficeMfaGateState {
  const [factors, setFactors] = useState<OfficeMfaTotpFactor[] | null>(
    enabled ? null : [],
  )
  const [aal, setAal] = useState<AuthenticatorAssuranceLevel | null>(
    enabled ? null : 'aal1',
  )
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFactors([])
      setAal('aal1')
      setError(null)
      return
    }

    setError(null)
    try {
      const [nextAal, nextFactors] = await Promise.all([
        getAuthenticatorAssuranceLevel(),
        listTotpFactors(),
      ])
      setAal(nextAal)
      setFactors(nextFactors)
    } catch (caught) {
      setFactors(null)
      setAal(null)
      setError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to verify multi-factor authentication status.',
      )
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) {
      setFactors([])
      setAal('aal1')
      setError(null)
      return
    }

    let cancelled = false
    setFactors(null)
    setAal(null)

    void (async () => {
      try {
        const [nextAal, nextFactors] = await Promise.all([
          getAuthenticatorAssuranceLevel(),
          listTotpFactors(),
        ])
        if (cancelled) return
        setAal(nextAal)
        setFactors(nextFactors)
        setError(null)
      } catch (caught) {
        if (cancelled) return
        setFactors(null)
        setAal(null)
        setError(
          caught instanceof MfaServiceError
            ? caught.message
            : 'Unable to verify multi-factor authentication status.',
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    function onFactorsChanged() {
      void refresh()
    }

    window.addEventListener(OFFICE_MFA_FACTORS_CHANGED_EVENT, onFactorsChanged)
    return () => {
      window.removeEventListener(
        OFFICE_MFA_FACTORS_CHANGED_EVENT,
        onFactorsChanged,
      )
    }
  }, [enabled, refresh])

  const decision = resolveOfficeMfaGate({
    isOfficeRole: enabled,
    aal,
    factors: enabled ? factors : [],
  })

  return {
    decision,
    factors: factors ?? [],
    aal,
    error,
    refresh,
  }
}
