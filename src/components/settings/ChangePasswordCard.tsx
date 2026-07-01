import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { settingsFieldClassName } from '@/components/settings/SettingsControls'
import { isSupabaseConfigured } from '@/lib/supabase'
import { authService, AuthServiceError } from '@/services/authService'

const MIN_PASSWORD_LENGTH = 8

export function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-[16px] bg-[#F8FAFC] px-4 py-4 ring-1 ring-[#E2E8F0]">
        <p className="text-sm font-semibold text-slate-800">Change Password</p>
        <p className="mt-2 text-sm text-slate-500">
          Coming later — Supabase Auth is not configured in this environment.
        </p>
      </div>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const trimmedPassword = newPassword.trim()
    const trimmedConfirm = confirmPassword.trim()

    if (!trimmedPassword) {
      setErrorMessage('Enter a new password.')
      return
    }

    if (trimmedPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }

    if (trimmedPassword !== trimmedConfirm) {
      setErrorMessage('Passwords do not match.')
      return
    }

    setIsSubmitting(true)

    try {
      await authService.updatePassword(trimmedPassword)
      setNewPassword('')
      setConfirmPassword('')
      setSuccessMessage('Password updated successfully.')
    } catch (error) {
      setErrorMessage(
        error instanceof AuthServiceError
          ? error.message
          : 'Unable to update password. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-[16px] bg-[#F8FAFC] px-4 py-5 ring-1 ring-[#E2E8F0] sm:px-5">
      <div>
        <p className="text-sm font-semibold text-slate-800">Change Password</p>
        <p className="mt-1 text-sm text-slate-500">
          Update your account password through Supabase Auth. You will stay signed in.
        </p>
      </div>

      <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
        {errorMessage ? (
          <p
            role="alert"
            className="rounded-[12px] bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 ring-1 ring-rose-100"
          >
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p
            role="status"
            className="rounded-[12px] bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100"
          >
            {successMessage}
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">New password</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={settingsFieldClassName}
              disabled={isSubmitting}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Confirm new password</span>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={settingsFieldClassName}
              disabled={isSubmitting}
            />
          </label>
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 rounded-[12px] bg-[#2563EB] px-4 text-sm font-semibold text-white hover:bg-[#1d4ed8] disabled:opacity-60"
        >
          {isSubmitting ? 'Updating…' : 'Update Password'}
        </Button>
      </form>
    </div>
  )
}
