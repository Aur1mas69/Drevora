import { useEffect, useState } from 'react'
import {
  OfficeMfaCodeForm,
  OfficeMfaShell,
} from '@/components/auth/OfficeMfaShell'
import {
  discardActiveTotpEnrollmentAttempt,
  enrollTotpFactor,
  MfaServiceError,
  verifyTotpEnrollment,
  type TotpEnrollment,
} from '@/services/mfaService'

export function OfficeMfaEnrollScreen({
  onCompleted,
}: {
  onCompleted: () => Promise<void> | void
}) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadGeneration, setLoadGeneration] = useState(0)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        // Single-flight inside mfaService: StrictMode remounts reuse the same
        // enroll() result (same factorId + QR + secret).
        const next = await enrollTotpFactor('Authenticator app')
        if (!cancelled) {
          setEnrollment(next)
        }
      } catch (error) {
        if (!cancelled) {
          setEnrollment(null)
          setLoadError(
            error instanceof MfaServiceError
              ? error.message
              : 'Unable to start authenticator setup.',
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [loadGeneration])

  async function handleVerify() {
    if (!enrollment) return
    setIsSubmitting(true)
    setVerifyError(null)
    try {
      await verifyTotpEnrollment({
        factorId: enrollment.factorId,
        code,
      })
      discardActiveTotpEnrollmentAttempt()
      await onCompleted()
    } catch (error) {
      // Stay on enrollment with the same factorId — do not re-enroll.
      setVerifyError(
        error instanceof MfaServiceError
          ? error.message
          : 'Invalid authenticator code. Try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <OfficeMfaShell
      title="Set up two-factor authentication"
      description="Office accounts require an authenticator app before you can use DREVORA Admin. Scan the QR code, then enter the 6-digit code to continue."
    >
      {isLoading ? (
        <p className="text-sm text-slate-600">Preparing authenticator setup…</p>
      ) : null}

      {loadError ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-rose-700" role="alert">
            {loadError}
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-[#2563EB] underline-offset-2 hover:underline"
            onClick={() => {
              discardActiveTotpEnrollmentAttempt()
              setEnrollment(null)
              setLoadGeneration((value) => value + 1)
            }}
          >
            Try again
          </button>
        </div>
      ) : null}

      {enrollment ? (
        <div className="space-y-5">
          <div className="flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <img
              src={enrollment.qrCode}
              alt="Authenticator QR code"
              className="size-48 rounded-lg bg-white"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
              Manual secret
            </p>
            <p className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
              {enrollment.secret}
            </p>
            <p className="mt-1.5 text-xs leading-5 text-slate-500">
              Enter this secret in your authenticator app if you cannot scan the QR code.
              DREVORA does not provide recovery codes.
            </p>
          </div>

          <OfficeMfaCodeForm
            code={code}
            onCodeChange={setCode}
            onSubmit={handleVerify}
            isSubmitting={isSubmitting}
            errorMessage={verifyError}
            submitLabel="Verify and continue"
          />
        </div>
      ) : null}
    </OfficeMfaShell>
  )
}
