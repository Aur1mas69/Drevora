import { useEffect, useId, useState, type ReactNode } from 'react'
import { ShieldCheck } from 'lucide-react'

import { settingsInnerCardClassName } from '@/components/settings/SettingsControls'
import { Button } from '@/components/ui/button'
import {
  formatOfficeMfaStatusLabel,
  listVerifiedTotpFactors,
  notifyOfficeMfaFactorsChanged,
  resolveMfaStatusAfterVerifiedFactorRemoval,
  type AuthenticatorAssuranceLevel,
  type OfficeMfaTotpFactor,
} from '@/lib/officeMfa'
import { isSupabaseConfigured } from '@/lib/supabase'
import {
  challengeAndVerifyTotp,
  clearUnverifiedTotpFactors,
  discardActiveTotpEnrollmentAttempt,
  enrollTotpFactor,
  getAuthenticatorAssuranceLevel,
  getOfficeMfaEnabled,
  listTotpFactors,
  MfaServiceError,
  MfaSettingsUnavailableError,
  pauseOwnOfficeMfa,
  removeOwnAuthenticator,
  resumeOwnOfficeMfa,
  verifyTotpEnrollment,
} from '@/services/mfaService'

type ChallengeIntent = 'pause' | 'resume' | 'remove'

function ConfirmMfaDialog({
  open,
  title,
  titleIdPrefix,
  confirmLabel,
  confirmingLabel,
  confirmVariant = 'destructive',
  confirmDisabled = false,
  isBusy,
  errorMessage,
  onCancel,
  onConfirm,
  children,
}: {
  open: boolean
  title: string
  titleIdPrefix: string
  confirmLabel: string
  confirmingLabel: string
  confirmVariant?: 'destructive' | 'default'
  confirmDisabled?: boolean
  isBusy: boolean
  errorMessage: string | null
  onCancel: () => void
  onConfirm: () => void
  children: ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isBusy) {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isBusy, onCancel, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]"
        aria-label={`Cancel ${titleIdPrefix}`}
        disabled={isBusy}
        onClick={() => {
          if (!isBusy) onCancel()
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
            {title}
          </h2>
        </div>

        <div className="space-y-3 px-5 py-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {children}
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
            disabled={isBusy}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            disabled={isBusy || confirmDisabled}
            onClick={onConfirm}
          >
            {isBusy ? confirmingLabel : confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  )
}

/**
 * Office Settings → Security MFA card.
 * Disable MFA = Pause (keeps the authenticator). Enable MFA = Resume existing
 * factor, or new enrollment only when none is saved. Remove authenticator is
 * a separate unenroll action.
 */
export function OfficeMfaSettingsCard() {
  const [factors, setFactors] = useState<OfficeMfaTotpFactor[]>([])
  const [aal, setAal] = useState<AuthenticatorAssuranceLevel | null>(null)
  const [mfaEnabled, setMfaEnabled] = useState(false)
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
  const [pendingDisable, setPendingDisable] = useState(false)
  const [challengeIntent, setChallengeIntent] = useState<ChallengeIntent | null>(
    null,
  )
  const [challengeFactorId, setChallengeFactorId] = useState('')
  const [challengeCode, setChallengeCode] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  async function refreshStatus() {
    setIsLoading(true)
    setError(null)
    try {
      const [nextAal, nextFactors, enabledResult] = await Promise.all([
        getAuthenticatorAssuranceLevel(),
        listTotpFactors(),
        getOfficeMfaEnabled()
          .then((value) => ({ ok: true as const, value }))
          .catch((caught: unknown) => ({ ok: false as const, caught })),
      ])
      setAal(nextAal)
      setFactors(nextFactors)
      if (enabledResult.ok) {
        setMfaEnabled(enabledResult.value)
      } else if (enabledResult.caught instanceof MfaSettingsUnavailableError) {
        setMfaEnabled(
          listVerifiedTotpFactors(nextFactors).length > 0,
        )
      } else {
        throw enabledResult.caught
      }
    } catch (caught) {
      setError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to load authenticator status.',
      )
      setFactors([])
      setAal(null)
      setMfaEnabled(false)
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
  const statusLabel = formatOfficeMfaStatusLabel(mfaEnabled)
  const hasSavedAuthenticator = verifiedCount > 0
  const sessionIsAal2 = aal === 'aal2'
  const activeChallengeFactorId = verifiedFactors.some(
    (factor) => factor.id === challengeFactorId,
  )
    ? challengeFactorId
    : verifiedFactors[0]?.id ?? ''

  async function handleStartAddFactor() {
    setIsStartingEnroll(true)
    setError(null)
    setInfo(null)
    try {
      discardActiveTotpEnrollmentAttempt()
      const next = await enrollTotpFactor(
        verifiedCount > 0
          ? `Authenticator ${verifiedCount + 1}`
          : 'Authenticator app',
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

  async function handleCancelEnrollment() {
    setEnrollment(null)
    setCode('')
    discardActiveTotpEnrollmentAttempt()
    try {
      await clearUnverifiedTotpFactors()
    } catch {
      // Best-effort cleanup of a temporary unverified factor.
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
      const shouldResume = !mfaEnabled
      setEnrollment(null)
      setCode('')
      if (shouldResume) {
        await resumeOwnOfficeMfa()
      }
      setInfo(
        shouldResume
          ? 'Authenticator verified. MFA is On.'
          : 'Authenticator verified.',
      )
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

  async function handleEnableMfa() {
    setError(null)
    setInfo(null)
    setActionError(null)

    if (verifiedCount === 0) {
      await handleStartAddFactor()
      return
    }

    if (sessionIsAal2) {
      setIsBusy(true)
      try {
        await resumeOwnOfficeMfa()
        setInfo('MFA is On. Your saved authenticator will be required at sign-in.')
        await refreshStatus()
        notifyOfficeMfaFactorsChanged()
      } catch (caught) {
        setError(
          caught instanceof MfaServiceError
            ? caught.message
            : 'Unable to enable MFA. Try again.',
        )
      } finally {
        setIsBusy(false)
      }
      return
    }

    setChallengeFactorId(verifiedFactors[0]?.id ?? '')
    setChallengeCode('')
    setChallengeIntent('resume')
  }

  function requestRemoveFactor(factor: OfficeMfaTotpFactor) {
    setActionError(null)
    setPendingRemove(factor)
  }

  function requestDisableMfa() {
    if (!mfaEnabled) {
      setError('MFA is already Off.')
      return
    }
    setActionError(null)
    setPendingDisable(true)
  }

  async function runPause() {
    await pauseOwnOfficeMfa()
    setPendingDisable(false)
    setEnrollment(null)
    setCode('')
    discardActiveTotpEnrollmentAttempt()
    setInfo(
      'MFA is Off. Your authenticator is still saved and can be enabled again without a new QR code.',
    )
    await refreshStatus()
    notifyOfficeMfaFactorsChanged()
  }

  async function runRemove(factor: OfficeMfaTotpFactor) {
    const wasLast = verifiedCount === 1
    const result = await removeOwnAuthenticator(factor.id)
    setPendingRemove(null)
    const after = resolveMfaStatusAfterVerifiedFactorRemoval({
      remainingVerifiedCount: result.remainingVerified.length,
      mfaEnabled: result.mfaEnabled,
    })
    setInfo(
      after.statusLabel === 'Off'
        ? wasLast
          ? 'Authenticator removed. MFA is Off.'
          : 'MFA is Off. You can sign in with email and password.'
        : 'Authenticator removed.',
    )
    await refreshStatus()
    notifyOfficeMfaFactorsChanged()
  }

  async function confirmRemoveFactor() {
    if (!pendingRemove || isBusy) return

    if (!sessionIsAal2) {
      setChallengeFactorId(pendingRemove.id)
      setChallengeCode('')
      setChallengeIntent('remove')
      setPendingRemove(null)
      return
    }

    setIsBusy(true)
    setActionError(null)
    setError(null)
    setInfo(null)

    try {
      await runRemove(pendingRemove)
    } catch (caught) {
      setActionError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to remove authenticator. Try again.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function confirmDisableMfa() {
    if (!pendingDisable || isBusy) return

    if (!sessionIsAal2) {
      setChallengeFactorId(verifiedFactors[0]?.id ?? '')
      setChallengeCode('')
      setChallengeIntent('pause')
      setPendingDisable(false)
      return
    }

    setIsBusy(true)
    setActionError(null)
    setError(null)
    setInfo(null)

    try {
      await runPause()
    } catch (caught) {
      setActionError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Unable to disable MFA. Try again.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  async function confirmChallenge() {
    if (!challengeIntent || isBusy) return
    if (!activeChallengeFactorId) {
      setActionError('No verified authenticator is available on this account.')
      return
    }

    setIsBusy(true)
    setActionError(null)
    setError(null)
    setInfo(null)

    try {
      await challengeAndVerifyTotp({
        factorId: activeChallengeFactorId,
        code: challengeCode,
      })

      if (challengeIntent === 'resume') {
        await resumeOwnOfficeMfa()
        setInfo('MFA is On. Your saved authenticator will be required at sign-in.')
      } else if (challengeIntent === 'pause') {
        await pauseOwnOfficeMfa()
        setInfo(
          'MFA is Off. Your authenticator is still saved and can be enabled again without a new QR code.',
        )
      } else {
        await removeOwnAuthenticator(activeChallengeFactorId)
        setInfo('Authenticator removed.')
      }

      setChallengeIntent(null)
      setChallengeCode('')
      await refreshStatus()
      notifyOfficeMfaFactorsChanged()
    } catch (caught) {
      setActionError(
        caught instanceof MfaServiceError
          ? caught.message
          : 'Invalid authenticator code. Try again.',
      )
    } finally {
      setIsBusy(false)
    }
  }

  function cancelChallenge() {
    if (isBusy) return
    setChallengeIntent(null)
    setChallengeCode('')
    setActionError(null)
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
  const removingLastFactor = pendingRemove != null && verifiedCount === 1

  const challengeTitle =
    challengeIntent === 'resume'
      ? 'Enable MFA'
      : challengeIntent === 'pause'
        ? 'Disable MFA'
        : 'Remove authenticator'
  const challengeConfirmLabel =
    challengeIntent === 'resume'
      ? 'Verify and enable'
      : challengeIntent === 'pause'
        ? 'Verify and disable'
        : 'Verify and remove'

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
                mfaEnabled
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {isLoading ? 'Checking…' : statusLabel}
            </span>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">
            MFA is optional for Office accounts. When it is On, sign-in requires
            your authenticator app until this session is fully verified. Recovery
            codes are not provided.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Loading authenticator status…
        </p>
      ) : mfaEnabled ? (
        <ul className="mt-3 space-y-2">
          {verifiedFactors.map((factor, index) => {
            const label =
              factor.friendlyName?.trim() || `Authenticator ${index + 1}`
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy || isVerifying || isStartingEnroll}
                  onClick={() => requestRemoveFactor(factor)}
                >
                  Remove authenticator
                </Button>
              </li>
            )
          })}
        </ul>
      ) : hasSavedAuthenticator ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            MFA is Off. Your authenticator is still saved. Enabling MFA will
            reuse it — a new QR code is not created.
          </p>
          <ul className="space-y-2">
            {verifiedFactors.map((factor, index) => {
              const label =
                factor.friendlyName?.trim() || `Authenticator ${index + 1}`
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
                      TOTP · Saved · MFA paused
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isBusy || isVerifying || isStartingEnroll}
                    onClick={() => requestRemoveFactor(factor)}
                  >
                    Remove authenticator
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          MFA is Off. Email and password are enough to use DREVORA.
        </p>
      )}

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
              onClick={() => void handleCancelEnrollment()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {mfaEnabled ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isLoading || isStartingEnroll || isBusy}
              onClick={requestDisableMfa}
            >
              Disable MFA
            </Button>
          ) : (
            <Button
              type="button"
              disabled={isLoading || isStartingEnroll || isBusy}
              onClick={() => void handleEnableMfa()}
            >
              {isStartingEnroll ? 'Preparing…' : 'Enable MFA'}
            </Button>
          )}
        </div>
      )}

      <ConfirmMfaDialog
        open={pendingRemove != null}
        title="Remove authenticator?"
        titleIdPrefix="remove authenticator"
        confirmLabel="Remove authenticator"
        confirmingLabel="Removing…"
        isBusy={isBusy}
        errorMessage={actionError}
        onCancel={() => {
          if (isBusy) return
          setPendingRemove(null)
          setActionError(null)
        }}
        onConfirm={() => void confirmRemoveFactor()}
      >
        <p>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {pendingLabel}
          </span>{' '}
          will stop working for sign-in. This creates a new secret if you add an
          authenticator later.
        </p>
        {removingLastFactor ? (
          <p>
            This is your last authenticator. MFA will be turned Off first, then
            the authenticator will be removed.
          </p>
        ) : mfaEnabled ? (
          <p>Your other verified authenticator(s) will keep working. MFA stays On.</p>
        ) : (
          <p>
            Your other saved authenticator(s) remain enrolled. MFA stays Off.
          </p>
        )}
      </ConfirmMfaDialog>

      <ConfirmMfaDialog
        open={pendingDisable}
        title="Disable MFA?"
        titleIdPrefix="disable MFA"
        confirmLabel="Disable MFA"
        confirmingLabel="Disabling…"
        isBusy={isBusy}
        errorMessage={actionError}
        onCancel={() => {
          if (isBusy) return
          setPendingDisable(false)
          setActionError(null)
        }}
        onConfirm={() => void confirmDisableMfa()}
      >
        <p>
          This turns MFA Off. Your authenticator stays saved on this account.
          Enabling MFA later reuses the same authenticator — a new QR code is
          not created.
        </p>
      </ConfirmMfaDialog>

      <ConfirmMfaDialog
        open={challengeIntent != null}
        title={challengeTitle}
        titleIdPrefix="authenticator challenge"
        confirmLabel={challengeConfirmLabel}
        confirmingLabel="Verifying…"
        confirmVariant={challengeIntent === 'resume' ? 'default' : 'destructive'}
        confirmDisabled={challengeCode.length !== 6}
        isBusy={isBusy}
        errorMessage={actionError}
        onCancel={cancelChallenge}
        onConfirm={() => void confirmChallenge()}
      >
        <p>
          Enter the 6-digit code from your authenticator app to continue. MFA
          is not changed until this code is verified.
        </p>
        {verifiedFactors.length > 1 ? (
          <div>
            <label
              htmlFor="settings-mfa-challenge-factor"
              className="text-sm font-medium text-slate-800 dark:text-slate-100"
            >
              Authenticator
            </label>
            <select
              id="settings-mfa-challenge-factor"
              value={activeChallengeFactorId}
              disabled={isBusy}
              onChange={(event) => setChallengeFactorId(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
            >
              {verifiedFactors.map((factor, index) => (
                <option key={factor.id} value={factor.id}>
                  {factor.friendlyName?.trim() || `Authenticator ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div>
          <label
            htmlFor="settings-mfa-challenge-code"
            className="text-sm font-medium text-slate-800 dark:text-slate-100"
          >
            Authenticator code
          </label>
          <input
            id="settings-mfa-challenge-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={challengeCode}
            disabled={isBusy}
            onChange={(event) =>
              setChallengeCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-center text-base font-semibold tracking-[0.3em] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 dark:border-white/10 dark:bg-slate-950"
            placeholder="000000"
          />
        </div>
      </ConfirmMfaDialog>
    </div>
  )
}
