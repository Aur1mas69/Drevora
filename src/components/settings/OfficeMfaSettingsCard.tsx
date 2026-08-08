import { useEffect, useId, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

import { settingsInnerCardClassName } from '@/components/settings/SettingsControls'
import { Button } from '@/components/ui/button'
import {
  canRemoveOwnVerifiedTotpFactor,
  formatOfficeMfaStatusLabel,
  listVerifiedTotpFactors,
  notifyOfficeMfaFactorsChanged,
  resolveMfaStatusAfterVerifiedFactorRemoval,
  type AuthenticatorAssuranceLevel,
  type OfficeMfaTotpFactor,
} from '@/lib/officeMfa'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  discardActiveTotpEnrollmentAttempt,
  enrollTotpFactor,
  getAuthenticatorAssuranceLevel,
  listTotpFactors,
  MfaServiceError,
  unenrollOwnVerifiedTotpFactor,
  verifyTotpEnrollment,
} from '@/services/mfaService'

function RemoveAuthenticatorDialog({
  open,
  factorLabel,
  isLastVerified,
  isRemoving,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  open: boolean
  factorLabel: string
  isLastVerified: boolean
  isRemoving: boolean
  errorMessage: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isRemoving) {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRemoving, onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        aria-label="Cancel remove authenticator"
        disabled={isRemoving}
        onClick={() => {
          if (!isRemoving) onCancel()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100"
          >
            Remove authenticator?
          </h2>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          <p>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {factorLabel}
            </span>{' '}
            will stop working for sign-in.
          </p>
          <p>Office accounts require multi-factor authentication.</p>
          {isLastVerified ? (
            <p className="font-medium text-amber-800 dark:text-amber-200">
              This is your last verified authenticator. After removal you will
              immediately need to set up a new one before using Admin again.
            </p>
          ) : (
            <p>
              Your other verified authenticator(s) will keep working.
            </p>
          )}
          {errorMessage ? (
            <p className="font-medium text-rose-700" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <Button
            type="button"
            variant="outline"
            disabled={isRemoving}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isRemoving}
            onClick={onConfirm}
          >
            {isRemoving ? 'Removing…' : 'Remove authenticator'}
          </Button>
        </div>
      </section>
    </div>
  )
}

/**
 * Office Settings → Security MFA card.
 * Shows status, verified factors, optional add-factor enrollment, and
 * AAL2-only self-service removal of the signed-in user's own factors.
 */
export function OfficeMfaSettingsCard() {
  const [factors, setFactors] = useState<OfficeMfaTotpFactor[]>([])
  const [aal, setAal] = useState<AuthenticatorAssuranceLevel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStartingEnroll, setIsStartingEnroll] = useState(false)
  const [enrollment, setEnrollment] = useState<{
    factorId: string
    qrCode: string
    secret: string
  } | null>(null)
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<OfficeMfaTotpFactor | null>(
    null,
  )
  const [isRemoving, setIsRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  async function refreshStatus() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextAal, nextFactors] = await Promise.all([
        getAuthenticatorAssuranceLevel(),
        listTotpFactors(),
      ])
      setAal(nextAal)
      setFactors(nextFactors)
    } catch (caught) {
      setError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to load authenticator status.',
      )
      setFactors([])
      setAal(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false)
      return
    }
    void refreshStatus()
  }, [])

  const verifiedFactors = listVerifiedTotpFactors(factors)
  const verifiedCount = verifiedFactors.length
  const statusLabel = formatOfficeMfaStatusLabel(verifiedCount > 0)
  const canOfferRemoval = aal === 'aal2'

  async function handleStartAddFactor() {
    setIsStartingEnroll(true)
    setError(null)
    setInfo(null)
    try {
      discardActiveTotpEnrollmentAttempt()
      const next = await enrollTotpFactor(
        verifiedCount > 0 ? `Authenticator ${verifiedCount + 1}` : 'Authenticator app',
      )
      setEnrollment({
        factorId: next.factorId,
        qrCode: next.qrCode,
        secret: next.secret,
      })
      setCode('')
    } catch (caught) {
      setError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to start authenticator enrollment.',
      )
    } finally {
      setIsStartingEnroll(false)
    }
  }

  async function handleVerifyEnrollment() {
    if (!enrollment) return
    setIsVerifying(true)
    setError(null)
    setInfo(null)
    try {
      await verifyTotpEnrollment({
        factorId: enrollment.factorId,
        code,
      })
      discardActiveTotpEnrollmentAttempt()
      setEnrollment(null)
      setCode('')
      setInfo('Authenticator verified and enabled.')
      await refreshStatus()
      notifyOfficeMfaFactorsChanged()
    } catch (caught) {
      setError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Invalid authenticator code. Try again.',
      )
    } finally {
      setIsVerifying(false)
    }
  }

  function requestRemoveFactor(factor: OfficeMfaTotpFactor) {
    if (
      !canRemoveOwnVerifiedTotpFactor({
        aal,
        factorId: factor.id,
        verifiedFactors,
      })
    ) {
      setError('Confirm two-factor authentication again before removing an authenticator.')
      return
    }
    setRemoveError(null)
    setPendingRemove(factor)
  }

  async function confirmRemoveFactor() {
    if (!pendingRemove || isRemoving) return

    if (
      !canRemoveOwnVerifiedTotpFactor({
        aal,
        factorId: pendingRemove.id,
        verifiedFactors,
      })
    ) {
      setRemoveError('That authenticator is not available to remove.')
      return
    }

    setIsRemoving(true)
    setRemoveError(null)
    setError(null)
    setInfo(null)

    try {
      const result = await unenrollOwnVerifiedTotpFactor(pendingRemove.id)
      setPendingRemove(null)

      const after = resolveMfaStatusAfterVerifiedFactorRemoval(
        result.remainingVerified.length,
      )
      setInfo(
        after.requiresEnrollment
          ? 'Authenticator removed. Set up a new authenticator to continue using Admin.'
          : 'Authenticator removed.',
      )

      await refreshStatus()
      notifyOfficeMfaFactorsChanged()
    } catch (caught) {
      setRemoveError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to remove authenticator. Try again.',
      )
    } finally {
      setIsRemoving(false)
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className={settingsInnerCardClassName}>
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Two-factor authentication
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Supabase Auth is not configured in this environment.
        </p>
      </div>
    )
  }

  const pendingLabel =
    pendingRemove?.friendlyName?.trim() ||
    (pendingRemove
      ? `Authenticator ${
          verifiedFactors.findIndex((factor) => factor.id === pendingRemove.id) + 1
        }`
      : 'Authenticator')

  return (
    <div className={settingsInnerCardClassName}>
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white ring-1 ring-[#E2E8F0] dark:bg-slate-800/70 dark:ring-white/10">
          <ShieldCheck className="size-5 text-[#2563EB]" strokeWidth={1.9} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Two-factor authentication
            </p>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                verifiedCount > 0
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              }`}
            >
              {isLoading ? 'Checking…' : statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Office accounts require a TOTP authenticator app. Recovery codes are not
            provided by Supabase. You can remove your own authenticators when this
            session is fully verified (AAL2).
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Loading authenticator status…
        </p>
      ) : verifiedCount === 0 ? (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          No verified authenticator apps yet.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {verifiedFactors.map((factor, index) => {
            const label =
              factor.friendlyName?.trim() || `Authenticator ${index + 1}`
            const removable = canRemoveOwnVerifiedTotpFactor({
              aal,
              factorId: factor.id,
              verifiedFactors,
            })
            return (
              <li
                key={factor.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E2E8F0] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900/60"
              >
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    TOTP · Verified
                  </span>
                </div>
                {canOfferRemoval ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isRemoving || isVerifying || isStartingEnroll || !removable}
                    onClick={() => requestRemoveFactor(factor)}
                  >
                    Remove authenticator
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {!canOfferRemoval && verifiedCount > 0 && !isLoading ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Removal is available after this session completes two-factor verification.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm font-medium text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
          {info}
        </p>
      ) : null}

      {enrollment ? (
        <div className="mt-4 space-y-4 rounded-[14px] border border-[#D3E9FC] bg-[#F8FBFF] p-4 dark:border-white/10 dark:bg-slate-900/50">
          <div className="flex justify-center">
            <img
              src={enrollment.qrCode}
              alt="Authenticator QR code"
              className="size-40 rounded-lg bg-white"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Manual secret
            </p>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
              {enrollment.secret}
            </p>
          </div>
          <div>
            <label
              htmlFor="settings-mfa-code"
              className="text-sm font-medium text-slate-800 dark:text-slate-100"
            >
              Authenticator code
            </label>
            <input
              id="settings-mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
              }
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-base font-semibold tracking-[0.3em] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 dark:border-white/10 dark:bg-slate-950"
              placeholder="000000"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={isVerifying || code.length !== 6}
              onClick={() => void handleVerifyEnrollment()}
            >
              {isVerifying ? 'Verifying…' : 'Verify authenticator'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isVerifying}
              onClick={() => {
                setEnrollment(null)
                setCode('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading || isStartingEnroll || isRemoving}
            onClick={() => void handleStartAddFactor()}
          >
            {isStartingEnroll
              ? 'Preparing…'
              : verifiedCount > 0
                ? 'Add another authenticator'
                : 'Set up authenticator'}
          </Button>
        </div>
      )}

      <RemoveAuthenticatorDialog
        open={pendingRemove != null}
        factorLabel={pendingLabel}
        isLastVerified={verifiedCount === 1}
        isRemoving={isRemoving}
        errorMessage={removeError}
        onCancel={() => {
          if (isRemoving) return
          setPendingRemove(null)
          setRemoveError(null)
        }}
        onConfirm={() => void confirmRemoveFactor()}
      />
    </div>
  )
}
