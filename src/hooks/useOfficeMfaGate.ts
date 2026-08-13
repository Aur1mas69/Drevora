import { useCallback, useEffect, useState } from 'react'
import {
  OFFICE_MFA_FACTORS_CHANGED_EVENT,
  hasVerifiedTotpFactor,
  resolveOfficeMfaGate,
  type AuthenticatorAssuranceLevel,
  type OfficeMfaGateDecision,
  type OfficeMfaTotpFactor,
} from '@/lib/officeMfa'
import {
  getAuthenticatorAssuranceLevel,
  getOfficeMfaEnabled,
  listTotpFactors,
  MfaServiceError,
  MfaSettingsUnavailableError,
} from '@/services/mfaService'

export type OfficeMfaGateState = {
  decision: OfficeMfaGateDecision
  factors: OfficeMfaTotpFactor[]
  aal: AuthenticatorAssuranceLevel | null
  mfaEnabled: boolean | null
  error: string | null
  refresh: () => Promise<void>
}

async function loadOfficeMfaSnapshot(): Promise<{
  aal: AuthenticatorAssuranceLevel
  factors: OfficeMfaTotpFactor[]
  mfaEnabled: boolean
}> {
  const [nextAal, nextFactors, enabledResult] = await Promise.all([
    getAuthenticatorAssuranceLevel(),
    listTotpFactors(),
    getOfficeMfaEnabled()
      .then((value) => ({ ok: true as const, value }))
      .catch((error: unknown) => ({ ok: false as const, error })),
  ])

  let mfaEnabled: boolean
  if (enabledResult.ok) {
    mfaEnabled = enabledResult.value
  } else if (enabledResult.error instanceof MfaSettingsUnavailableError) {
    // STEP 1 Pause/Resume RPCs are not live yet. Fall back to verified-factor
    // presence so Office is not bricked. Pause/Resume writes still fail until
    // the migration is applied. Never uses localStorage or IP.
    mfaEnabled = hasVerifiedTotpFactor(nextFactors)
  } else {
    throw enabledResult.error
  }

  return { aal: nextAal, factors: nextFactors, mfaEnabled }
}

/**
 * Loads Supabase MFA assurance + TOTP factors + server mfa_enabled.
 * Call only after company_members has confirmed an Office role.
 */
export function useOfficeMfaGate(enabled: boolean): OfficeMfaGateState {
  const [factors, setFactors] = useState<OfficeMfaTotpFactor[] | null>(
    enabled ? null : [],
  )
  const [aal, setAal] = useState<AuthenticatorAssuranceLevel | null>(
    enabled ? null : 'aal1',
  )
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(
    enabled ? null : false,
  )
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFactors([])
      setAal('aal1')
      setMfaEnabled(false)
      setError(null)
      return
    }

    setError(null)
    try {
      const next = await loadOfficeMfaSnapshot()
      setAal(next.aal)
      setFactors(next.factors)
      setMfaEnabled(next.mfaEnabled)
    } catch (caught) {
      setFactors(null)
      setAal(null)
      setMfaEnabled(null)
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
      setMfaEnabled(false)
      setError(null)
      return
    }

    let cancelled = false
    setFactors(null)
    setAal(null)
    setMfaEnabled(null)

    void (async () => {
      try {
        const next = await loadOfficeMfaSnapshot()
        if (cancelled) return
        setAal(next.aal)
        setFactors(next.factors)
        setMfaEnabled(next.mfaEnabled)
        setError(null)
      } catch (caught) {
        if (cancelled) return
        setFactors(null)
        setAal(null)
        setMfaEnabled(null)
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
    mfaEnabled: enabled ? mfaEnabled : false,
  })

  return {
    decision,
    factors: factors ?? [],
    aal,
    mfaEnabled,
    error,
    refresh,
  }
}
