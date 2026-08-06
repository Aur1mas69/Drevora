import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  canSubmitChangeWorkerLoginEmail,
  normalizeLoginEmail,
} from '@/lib/workerLoginEmail'
import {
  changeWorkerLoginEmail,
  WorkerLoginEmailServiceError,
} from '@/services/workerLoginEmailService'

type ChangeWorkerLoginEmailModalProps = {
  workerId: string
  workerLabel: string
  currentEmail: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: { email: string; toastMessage: string }) => void
}

const fieldInputClass =
  'mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10'

export function ChangeWorkerLoginEmailModal({
  workerId,
  workerLabel,
  currentEmail,
  isOpen,
  onClose,
  onSuccess,
}: ChangeWorkerLoginEmailModalProps) {
  const [newEmail, setNewEmail] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')
  const [reason, setReason] = useState('')
  const [samePersonConfirmed, setSamePersonConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setNewEmail('')
    setConfirmEmail('')
    setReason('')
    setSamePersonConfirmed(false)
    setIsSubmitting(false)
    setErrorMessage(null)
  }, [isOpen, workerId, currentEmail])

  const canSubmit = useMemo(
    () =>
      canSubmitChangeWorkerLoginEmail({
        currentEmail,
        newEmail,
        confirmEmail,
        reason,
        samePersonConfirmed,
      }),
    [confirmEmail, currentEmail, newEmail, reason, samePersonConfirmed],
  )

  if (!isOpen) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)

    const normalizedNew = normalizeLoginEmail(newEmail)
    const normalizedConfirm = normalizeLoginEmail(confirmEmail)
    if (
      !normalizedNew ||
      !normalizedConfirm ||
      normalizedNew !== normalizedConfirm
    ) {
      setErrorMessage('New email and confirmation must match.')
      return
    }
    if (!reason.trim()) {
      setErrorMessage('Enter a reason for this change.')
      return
    }
    if (!samePersonConfirmed) {
      setErrorMessage(
        'Confirm this is the same person before changing login email.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const result = await changeWorkerLoginEmail({
        workerId,
        newEmail: normalizedNew,
        reason: reason.trim(),
        samePersonConfirmed: true,
      })
      setNewEmail('')
      setConfirmEmail('')
      setReason('')
      setSamePersonConfirmed(false)
      onSuccess({
        email: result.email,
        toastMessage: result.toastMessage,
      })
    } catch (error) {
      if (error instanceof WorkerLoginEmailServiceError) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(
          'Unable to change Worker login email right now. Please try again.',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-[20px] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-blue-100 dark:bg-slate-950 dark:ring-white/10">
        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3B82F6] dark:text-blue-400">
              Login email
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
              Change login email
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Update the Auth login email for {workerLabel}. Worker ID and
              history stay the same.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Current email
            </span>
            <Input
              type="email"
              value={currentEmail}
              readOnly
              className={`${fieldInputClass} cursor-default opacity-90`}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              New email <span className="text-rose-500">*</span>
            </span>
            <Input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              className={fieldInputClass}
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Confirm new email <span className="text-rose-500">*</span>
            </span>
            <Input
              type="email"
              value={confirmEmail}
              onChange={(event) => setConfirmEmail(event.target.value)}
              className={fieldInputClass}
              autoComplete="email"
              required
              disabled={isSubmitting}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Reason <span className="text-rose-500">*</span>
            </span>
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={fieldInputClass}
              placeholder="e.g. Corrected company email typo"
              required
              disabled={isSubmitting}
            />
          </label>

          <label className="flex items-start gap-3 rounded-[16px] bg-[#F8FBFF] px-4 py-3 ring-1 ring-blue-100 dark:bg-slate-900/50 dark:ring-white/10">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
              checked={samePersonConfirmed}
              onChange={(event) => setSamePersonConfirmed(event.target.checked)}
              disabled={isSubmitting}
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              I confirm this is the same person and the email address is
              correct.
            </span>
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                if (isSubmitting) return
                onClose()
              }}
              className="rounded-[16px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
              className="rounded-[16px]"
            >
              {isSubmitting ? 'Updating...' : 'Confirm email change'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
