import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AccountDeletionServiceError,
  requestAccountDeletion,
} from '@/services/accountDeletionService'
import { useEffect, useId, useState } from 'react'

type WorkerDeleteAccountDialogProps = {
  open: boolean
  accountEmail: string
  onCancel: () => void
  onScheduled: (scheduledFor: string) => void
}

/**
 * Confirm Worker account deletion. Requires typing the exact account email.
 * Does not delete Auth from the client — schedules via Edge Function.
 */
export function WorkerDeleteAccountDialog({
  open,
  accountEmail,
  onCancel,
  onScheduled,
}: WorkerDeleteAccountDialogProps) {
  const titleId = useId()
  const emailInputId = useId()
  const [confirmEmail, setConfirmEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const expectedEmail = accountEmail.trim()
  const emailMatches =
    confirmEmail.trim().length > 0 &&
    confirmEmail.trim().toLowerCase() === expectedEmail.toLowerCase() &&
    confirmEmail.trim() === expectedEmail

  useEffect(() => {
    if (!open) return
    setConfirmEmail('')
    setErrorMessage(null)
    setIsSubmitting(false)
  }, [open])

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault()
        onCancel()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSubmitting, onCancel, open])

  if (!open) return null

  async function handleConfirm() {
    if (!emailMatches || isSubmitting) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await requestAccountDeletion()
      onScheduled(result.scheduledFor)
    } catch (error) {
      setErrorMessage(
        error instanceof AccountDeletionServiceError
          ? error.message
          : 'Unable to schedule account deletion right now.',
      )
      setIsSubmitting(false)
    }
  }

  return (
    <div className="worker-theme-surface fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
        aria-label="Cancel account deletion"
        disabled={isSubmitting}
        onClick={() => {
          if (!isSubmitting) onCancel()
        }}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-md overflow-hidden rounded-[20px] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)]"
      >
        <div className="border-b border-[color:var(--worker-border)] px-5 py-4">
          <h2
            id={titleId}
            className="text-lg font-semibold tracking-[-0.03em] text-rose-700 sm:text-xl"
          >
            Delete account?
          </h2>
          <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--worker-text-secondary)]">
            <p>This action cannot be undone from inside the app.</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Access will be disabled immediately.</li>
              <li>
                Final deletion and anonymisation of personal account data occurs
                within 30 days.
              </li>
              <li>
                Retained operational and legal records (such as Vehicle Checks,
                timesheets and compliance evidence) may remain according to
                policy.
              </li>
              <li>
                You can cancel before the scheduled date by contacting your
                organisation administrator or DREVORA support at{' '}
                <span className="font-medium text-[color:var(--worker-text)]">
                  admin@drevora.uk
                </span>
                .
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block space-y-1.5" htmlFor={emailInputId}>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
              Type your account email to confirm
            </span>
            <Input
              id={emailInputId}
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirmEmail}
              disabled={isSubmitting}
              placeholder={expectedEmail || 'you@company.com'}
              onChange={(event) => {
                setErrorMessage(null)
                setConfirmEmail(event.target.value)
              }}
              className="h-12 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] text-base text-[color:var(--worker-text)]"
            />
          </label>

          {errorMessage ? (
            <p className="text-sm font-medium text-rose-600" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onCancel}
              className="h-12 rounded-2xl px-5 font-semibold"
            >
              Keep account
            </Button>
            <Button
              type="button"
              disabled={!emailMatches || isSubmitting}
              onClick={() => {
                void handleConfirm()
              }}
              className="h-12 rounded-2xl bg-rose-600 px-5 font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Scheduling…' : 'Delete account'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
