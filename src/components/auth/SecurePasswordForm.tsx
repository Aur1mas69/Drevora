import { useMemo, useState, type FormEvent } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordRequirementsChecklist, PasswordMatchStatusMessage } from '@/components/auth/PasswordRequirementsChecklist'
import {
  evaluatePassword,
  getPasswordMatchStatus,
  getPasswordPolicyError,
  passwordsMatch,
} from '@/lib/passwordValidation'
import { cn } from '@/lib/utils'

const passwordFieldClassName =
  'h-11 w-full rounded-[14px] border border-[#D7E8FF]/90 bg-white px-3 pr-11 text-sm font-medium text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus-visible:border-[#4F8DFF] focus-visible:ring-3 focus-visible:ring-[#4F8DFF]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-500/25'

const REQUIREMENTS_ID = 'secure-password-requirements'

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

type PasswordFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: 'new-password' | 'current-password'
  disabled?: boolean
  describedBy?: string
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled = false,
  describedBy,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <label className="block space-y-1.5" htmlFor={id}>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </span>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          aria-describedby={describedBy}
          className={passwordFieldClassName}
        />
        <button
          type="button"
          aria-label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F8DFF]/35 disabled:opacity-50 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {visible ? (
            <EyeOff className="size-[18px]" strokeWidth={1.9} />
          ) : (
            <Eye className="size-[18px]" strokeWidth={1.9} />
          )}
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
  const matchStatus = getPasswordMatchStatus(newPassword, confirmPassword)
  const confirmMatches = passwordsMatch(newPassword, confirmPassword)
  const canSubmit = validation.isValid && confirmMatches && !isSubmitting

  const copy = VARIANT_COPY[variant]

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const policyError = getPasswordPolicyError(newPassword, confirmPassword)
    if (policyError) {
      setErrorMessage(policyError)
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
    <div className="secure-password-form overflow-hidden rounded-[20px] border border-[rgba(75,120,220,0.12)] bg-gradient-to-b from-white to-[#F8FBFF] p-6 shadow-[0_8px_32px_rgba(47,115,255,0.06)] sm:p-8 dark:border-white/10 dark:from-slate-900 dark:to-slate-900/95 dark:shadow-none">
      <div className="mx-auto max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="secure-password-form__icon flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F8DFF] to-[#6366F1] text-white shadow-[0_10px_28px_rgba(79,141,255,0.35)]">
            <Lock className="size-5" strokeWidth={2} />
          </div>
          <h3 className="secure-password-form__title mt-4 text-xl font-semibold tracking-[-0.03em] text-[#2A376F] dark:text-slate-100">
            {copy.title}
          </h3>
          <p className="secure-password-form__subtitle mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Use a strong password to protect your DREVORA account.
          </p>
        </div>

        <form
          className="mt-7 space-y-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
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
            describedBy={
              newPassword.length > 0 ? REQUIREMENTS_ID : undefined
            }
          />

          <PasswordRequirementsChecklist
            id={REQUIREMENTS_ID}
            validation={validation}
            visible={newPassword.length > 0}
            tone="settings"
          />

          <PasswordField
            id="confirm-password"
            label="Confirm password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            disabled={isSubmitting}
          />

          <PasswordMatchStatusMessage status={matchStatus} tone="settings" />

          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              'secure-password-form__submit h-11 w-full rounded-[14px] bg-gradient-to-r from-[#A3F1AB] via-[#6D6EFF] to-[#4344F6] text-sm font-semibold text-white shadow-[0_10px_28px_rgba(67,68,246,0.4)] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55',
            )}
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
