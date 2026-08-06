import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { canSubmitSendWorkerAccessEmail } from '@/lib/workerAccessEmail'
import {
  sendWorkerAccessEmail,
  WorkerAccessEmailServiceError,
} from '@/services/workerAccessEmailService'

type SendWorkerAccessEmailModalProps = {
  workerId: string
  workerLabel: string
  currentEmail: string
  isOpen: boolean
  onClose: () => void
  onSuccess: (result: { email: string; toastMessage: string }) => void
}

const fieldInputClass =
  'mt-2 h-11 rounded-[16px] border-0 bg-[#F8FBFF] px-3 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-blue-100 focus-visible:ring-3 focus-visible:ring-blue-200 dark:bg-slate-900/70 dark:text-slate-100 dark:ring-white/10'

export function SendWorkerAccessEmailModal({
  workerId,
  workerLabel,
  currentEmail,
  isOpen,
  onClose,
  onSuccess,
}: SendWorkerAccessEmailModalProps) {
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setEmailConfirmed(false)
    setIsSubmitting(false)
    setErrorMessage(null)
  }, [isOpen, workerId, currentEmail])

  const canSubmit = useMemo(
    () =>
      canSubmitSendWorkerAccessEmail({
        emailConfirmed,
        expectedEmail: currentEmail,
      }),
    [currentEmail, emailConfirmed],
  )

  if (!isOpen) return null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setErrorMessage(null)

    if (!emailConfirmed) {
      setErrorMessage(
        'Confirm the email address belongs to this Worker before sending.',
      )
      return
    }

    setIsSubmitting(true)
    try {
      const result = await sendWorkerAccessEmail({
        workerId,
        expectedEmail: currentEmail,
        emailConfirmed: true,
      })
      setEmailConfirmed(false)
      onSuccess({
        email: result.email,
        toastMessage: result.toastMessage,
      })
    } catch (error) {
      if (error instanceof WorkerAccessEmailServiceError) {
        setErrorMessage(error.message)
      } else {
        setErrorMessage(
          'Unable to send account access email right now. Please try again.',
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
              Account access
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-slate-50">
              Send account access email
            </h2>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {workerLabel} will receive a secure email to set or reset their
              password. The message is always sent to their current Auth login
              email.
            </p>
          </div>

          {errorMessage ? (
            <div className="rounded-[16px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Login email
            </span>
            <Input
              type="email"
              value={currentEmail}
              readOnly
              className={`${fieldInputClass} cursor-default opacity-90`}
            />
          </label>

          <label className="flex items-start gap-3 rounded-[16px] bg-[#F8FBFF] px-4 py-3 ring-1 ring-blue-100 dark:bg-slate-900/50 dark:ring-white/10">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#3B82F6] focus:ring-[#3B82F6]"
              checked={emailConfirmed}
              onChange={(event) => setEmailConfirmed(event.target.checked)}
              disabled={isSubmitting}
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              I confirm this email address belongs to this Worker and is
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
              {isSubmitting ? 'Sending...' : 'Send account access email'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
