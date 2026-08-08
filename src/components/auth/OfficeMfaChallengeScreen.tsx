import { useMemo, useState } from 'react'
import {
  OfficeMfaCodeForm,
  OfficeMfaShell,
} from '@/components/auth/OfficeMfaShell'
import { listVerifiedTotpFactors, type OfficeMfaTotpFactor } from '@/lib/officeMfa'
import {
  challengeAndVerifyTotp,
  MfaServiceError,
} from '@/services/mfaService'

export function OfficeMfaChallengeScreen({
  factors,
  onCompleted,
}: {
  factors: OfficeMfaTotpFactor[]
  onCompleted: () => Promise<void> | void
}) {
  const verifiedFactors = useMemo(
    () => listVerifiedTotpFactors(factors),
    [factors],
  )
  const [factorId, setFactorId] = useState(
    () => verifiedFactors[0]?.id ?? '',
  )
  const [code, setCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeFactorId = verifiedFactors.some((factor) => factor.id === factorId)
    ? factorId
    : verifiedFactors[0]?.id ?? ''

  async function handleVerify() {
    if (!activeFactorId) {
      setErrorMessage('No verified authenticator is available on this account.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      await challengeAndVerifyTotp({
        factorId: activeFactorId,
        code,
      })
      await onCompleted()
    } catch (error) {
      setErrorMessage(
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
      title="Two-factor authentication"
      description="Enter the 6-digit code from your authenticator app to continue to DREVORA Admin."
    >
      {verifiedFactors.length > 1 ? (
        <div className="mb-4">
          <label
            htmlFor="office-mfa-factor"
            className="text-sm font-medium text-slate-800"
          >
            Authenticator
          </label>
          <select
            id="office-mfa-factor"
            value={activeFactorId}
            onChange={(event) => setFactorId(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
          >
            {verifiedFactors.map((factor, index) => (
              <option key={factor.id} value={factor.id}>
                {factor.friendlyName?.trim() || `Authenticator ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <OfficeMfaCodeForm
        code={code}
        onCodeChange={setCode}
        onSubmit={handleVerify}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
        submitLabel="Verify and continue"
      />
    </OfficeMfaShell>
  )
}
