import { useMemo, useState, type FormEvent } from 'react'
import { Check, Circle, Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  evaluatePassword,
  PASSWORD_STRENGTH_LABELS,
  PASSWORD_STRENGTH_PROGRESS,
  passwordsMatch,
  type PasswordStrengthLevel,
} from '@/lib/passwordValidation'
import { cn } from '@/lib/utils'

const passwordFieldClassName =
  'h-11 w-full rounded-[14px] border border-[#D7E8FF]/90 bg-white px-3 pr-11 text-sm font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus-visible:border-[#4F8DFF] focus-visible:ring-3 focus-visible:ring-[#4F8DFF]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-500/25'

type SecurePasswordFormVariant = 'change' | 'create'

type SecurePasswordFormProps = {
  variant?: SecurePasswordFormVariant
  onSubmit: (password: string) => Promise<void>
}

const VARIANT_COPY: Record<
  SecurePasswordFormVariant,
  { title: string; submitLabel: string }
> = {
  change: {
    title: 'Change password',
    submitLabel: 'Update password',
  },
  create: {
    title: 'Create a secure password',
    submitLabel: 'Continue',
  },
}

function strengthBarClass(strength: PasswordStrengthLevel): string {
  switch (strength) {
    case 'weak':
      return 'bg-gradient-to-r from-rose-500 to-orange-500'
    case 'medium':
      return 'bg-gradient-to-r from-amber-400 to-yellow-500'
    case 'strong':
      return 'bg-gradient-to-r from-emerald-500 to-green-500'
    case 'very-strong':
      return 'bg-gradient-to-r from-emerald-600 to-teal-500'
  }
}

function strengthLabelClass(strength: PasswordStrengthLevel): string {
  switch (strength) {
    case 'weak':
      return 'text-rose-600 dark:text-rose-400'
    case 'medium':
      return 'text-amber-600 dark:text-amber-400'
    case 'strong':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'very-strong':
      return 'text-teal-700 dark:text-teal-300'
  }
}

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'new-password' | 'current-password'
  disabled?: boolean
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={passwordFieldClassName}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600 disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {visible ? <EyeOff className="size-[18px]" strokeWidth={1.9} /> : <Eye className="size-[18px]" strokeWidth={1.9} />}
        </button>
      </div>
    </label>
  )
}

export function SecurePasswordForm({
  variant = 'change',
  onSubmit,
}: SecurePasswordFormProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const validation = useMemo(() => evaluatePassword(newPassword), [newPassword])
  const confirmMatches = passwordsMatch(newPassword, confirmPassword)
  const confirmTouched = confirmPassword.length > 0
  const canSubmit =
    validation.isValid && confirmMatches && !isSubmitting

  const copy = VARIANT_COPY[variant]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!validation.isValid) {
      setErrorMessage('Password is not strong enough.')
      return
    }

    if (!confirmMatches) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMessage(
        variant === 'change'
          ? 'Password updated successfully.'
          : 'Password saved successfully.',
      )
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to update password.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="overflow-hidden rounded-[20px] border border-[rgba(75,120,220,0.12)] bg-gradient-to-b from-white to-[#F8FBFF] p-6 shadow-[0_8px_32px_rgba(47,115,255,0.06)] sm:p-8 dark:border-white/10 dark:from-slate-900 dark:to-slate-900/95 dark:shadow-none">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F8DFF] to-[#6366F1] text-white shadow-[0_10px_28px_rgba(79,141,255,0.35)]">
            <Lock className="size-5" strokeWidth={2} />
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
            {copy.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Use a strong password to protect your DREVORA account.
          </p>
        </div>

        <form className="mt-7 space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-[14px] bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60"
            >
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p
              role="status"
              className="rounded-[14px] bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60"
            >
              {successMessage}
            </p>
          ) : null}

          <PasswordField
            id="new-password"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
            disabled={isSubmitting}
          />

          {newPassword.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  Password strength
                </p>
                <p
                  className={cn(
                    'text-xs font-semibold',
                    strengthLabelClass(validation.strength),
                  )}
                >
                  {PASSWORD_STRENGTH_LABELS[validation.strength]}
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300 ease-out',
                    strengthBarClass(validation.strength),
                  )}
                  style={{ width: `${PASSWORD_STRENGTH_PROGRESS[validation.strength]}%` }}
                  role="progressbar"
                  aria-valuenow={PASSWORD_STRENGTH_PROGRESS[validation.strength]}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Password strength: ${PASSWORD_STRENGTH_LABELS[validation.strength]}`}
                />
              </div>
            </div>
          ) : null}

          {newPassword.length > 0 ? (
            <ul className="space-y-2 rounded-[14px] bg-[#F1F5F9]/60 px-4 py-3 ring-1 ring-[#E2E8F0]/80 dark:bg-slate-800/60 dark:ring-slate-700/80">
              {validation.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-2.5 text-sm">
                  {check.satisfied ? (
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 size-4 shrink-0 text-slate-300 dark:text-slate-600"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                  <span
                    className={cn(
                      'leading-5',
                      check.satisfied
                        ? 'font-medium text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-500 dark:text-slate-400',
                    )}
                  >
                    {check.label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={isSubmitting}
          />

          {confirmTouched && !confirmMatches ? (
            <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
              Passwords do not match.
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-11 w-full rounded-[14px] bg-gradient-to-r from-[#4F8DFF] to-[#6366F1] text-sm font-semibold text-white shadow-[0_10px_28px_rgba(79,141,255,0.28)] hover:from-[#4580ef] hover:to-[#5b5ee8] disabled:opacity-50"
          >
            {isSubmitting
              ? variant === 'change'
                ? 'Updating…'
                : 'Saving…'
              : copy.submitLabel}
          </Button>
        </form>
      </div>
    </div>
  )
}
