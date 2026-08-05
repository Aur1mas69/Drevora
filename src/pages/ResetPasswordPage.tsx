import drevoraLogoFull from '@/assets/drevora-logo-full.png'
import {
  PasswordMatchStatusMessage,
  PasswordRequirementsChecklist,
} from '@/components/auth/PasswordRequirementsChecklist'
import {
  authService,
  AuthServiceError,
} from '@/services/authService'
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import {
  evaluatePassword,
  getPasswordMatchStatus,
  getPasswordPolicyError,
  passwordsMatch,
} from '@/lib/passwordValidation'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const authInputClassName =
  'h-11 w-full rounded-xl border border-sky-200/80 bg-white/75 pl-10 pr-10 text-sm text-[#0F1B35] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 lg:h-[60px] lg:rounded-[10px] lg:border-sky-300/85 lg:bg-white/80 lg:pl-12 lg:pr-12 lg:text-base lg:focus:ring-[3px] lg:focus:ring-[#2563EB]/28'

const REQUIREMENTS_ID = 'reset-password-requirements'
const RECOVERY_SETTLE_MS = 2500

type PageStatus =
  | 'checking'
  | 'ready'
  | 'invalid'
  | 'updating'
  | 'success'

function ResetPasswordPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<PageStatus>('checking')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [signOutFailed, setSignOutFailed] = useState(false)

  const validation = useMemo(() => evaluatePassword(newPassword), [newPassword])
  const matchStatus = getPasswordMatchStatus(newPassword, confirmPassword)
  const confirmMatches = passwordsMatch(newPassword, confirmPassword)
  const canSubmit =
    status === 'ready' && validation.isValid && confirmMatches

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setStatus('invalid')
      return
    }

    let cancelled = false
    let settled = false

    function markReady() {
      if (cancelled || settled) return
      settled = true
      setStatus('ready')
    }

    function markInvalid() {
      if (cancelled || settled) return
      settled = true
      setStatus('invalid')
    }

    const {
      data: { subscription },
    } = requireSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        markReady()
      }
    })

    void (async () => {
      try {
        const { data } = await requireSupabase().auth.getSession()
        if (cancelled) return

        if (data.session) {
          markReady()
          return
        }

        await new Promise((resolve) => setTimeout(resolve, RECOVERY_SETTLE_MS))
        if (cancelled || settled) return

        const again = await requireSupabase().auth.getSession()
        if (again.data.session) {
          markReady()
        } else {
          markInvalid()
        }
      } catch {
        markInvalid()
      }
    })()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  function validatePasswords(): string | null {
    return getPasswordPolicyError(newPassword, confirmPassword)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (status === 'updating') return

    const validationError = validatePasswords()
    if (validationError) {
      setFieldError(validationError)
      return
    }

    setFieldError(null)
    setSubmitError(null)
    setStatus('updating')

    try {
      await authService.updatePassword(newPassword)

      try {
        await authService.signOut()
        setSignOutFailed(false)
      } catch {
        setSignOutFailed(true)
      }

      setStatus('success')
    } catch (error) {
      setStatus('ready')
      setSubmitError(
        error instanceof AuthServiceError
          ? error.message
          : 'Unable to update your password. Please try again.',
      )
    }
  }

  return (
    <div className="relative min-h-dvh w-full bg-gradient-to-b from-white via-sky-50 to-sky-100 lg:h-dvh lg:min-h-0 lg:overflow-hidden">
      <img
        src="/images/login-office-background.png"
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none absolute inset-0 size-full select-none object-cover object-center lg:object-contain"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/64 via-white/51 to-sky-100/45"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center px-4 py-8 lg:absolute lg:inset-0 lg:min-h-0 lg:px-6 lg:pt-[10vh] lg:pb-[3vh]">
        <img
          src={drevoraLogoFull}
          alt="DREVORA"
          className="mb-6 h-auto w-full max-w-[240px] object-contain lg:mb-[2vh] lg:max-h-[7vh] lg:w-auto"
        />

        <div
          className="w-full max-w-[440px] rounded-[22px] border border-sky-200/70 bg-white/72 px-6 py-7 shadow-[0_24px_64px_-28px_rgba(56,120,190,0.35)] backdrop-blur-sm sm:px-8 sm:py-8 lg:max-h-[76vh] lg:max-w-[480px] lg:overflow-y-auto lg:overscroll-contain lg:rounded-[28px] lg:bg-white/58 lg:px-10 lg:py-8 lg:shadow-[0_40px_100px_-32px_rgba(100,130,170,0.45)] lg:ring-1 lg:ring-sky-200/50"
          aria-label="Reset password"
        >
          {status === 'checking' ? (
            <div className="space-y-3 text-center">
              <h1 className="text-2xl font-bold text-[#0F1B35]">
                Checking recovery link
              </h1>
              <p className="text-sm text-[#64748B]">
                Please wait while we verify your password reset link…
              </p>
            </div>
          ) : null}

          {status === 'invalid' ? (
            <div className="space-y-6 text-center">
              <h1 className="text-2xl font-bold text-[#0F1B35]">
                Link unavailable
              </h1>
              <p className="text-sm leading-relaxed text-[#64748B]">
                This password reset link is invalid or has expired.
              </p>
              <Link
                to="/forgot-password"
                className="flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.65)] lg:h-[52px]"
              >
                Request a New Link
              </Link>
              <Link
                to={LOGIN_PATH}
                className="block w-full text-sm font-medium text-[#64748B] transition-colors hover:text-[#2563EB]"
              >
                ← Back to Login
              </Link>
            </div>
          ) : null}

          {status === 'ready' || status === 'updating' ? (
            <>
              <h1 className="text-center text-2xl font-bold text-[#0F1B35] lg:text-[28px]">
                Choose a new password
              </h1>
              <p className="mt-3 text-center text-sm leading-relaxed text-[#64748B]">
                Enter and confirm your new password below.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label
                    htmlFor="reset-new-password"
                    className="block text-sm font-medium text-[#0F1B35] lg:font-semibold"
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#64748B] lg:left-4 lg:size-5"
                      aria-hidden
                    />
                    <input
                      id="reset-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      name="new-password"
                      value={newPassword}
                      onChange={(event) => {
                        setFieldError(null)
                        setSubmitError(null)
                        setNewPassword(event.target.value)
                      }}
                      autoComplete="new-password"
                      required
                      className={authInputClassName}
                      aria-label="New Password"
                      aria-describedby={
                        newPassword.length > 0 ? REQUIREMENTS_ID : undefined
                      }
                      disabled={status === 'updating'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((visible) => !visible)}
                      aria-label={
                        showNewPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-[#64748B] transition-colors hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/28 lg:right-4"
                    >
                      {showNewPassword ? (
                        <EyeOff className="size-4 lg:size-5" aria-hidden />
                      ) : (
                        <Eye className="size-4 lg:size-5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <PasswordRequirementsChecklist
                  id={REQUIREMENTS_ID}
                  validation={validation}
                  visible={newPassword.length > 0}
                  tone="public"
                />

                <div className="space-y-2">
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-sm font-medium text-[#0F1B35] lg:font-semibold"
                  >
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#64748B] lg:left-4 lg:size-5"
                      aria-hidden
                    />
                    <input
                      id="reset-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirm-password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setFieldError(null)
                        setSubmitError(null)
                        setConfirmPassword(event.target.value)
                      }}
                      autoComplete="new-password"
                      required
                      className={authInputClassName}
                      aria-label="Confirm New Password"
                      disabled={status === 'updating'}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                      aria-label={
                        showConfirmPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-[#64748B] transition-colors hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/28 lg:right-4"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="size-4 lg:size-5" aria-hidden />
                      ) : (
                        <Eye className="size-4 lg:size-5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <PasswordMatchStatusMessage status={matchStatus} tone="public" />

                {fieldError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-snug text-red-600"
                  >
                    {fieldError}
                  </p>
                ) : null}

                {submitError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-snug text-red-600"
                  >
                    {submitError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.65)] transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:translate-y-0 lg:h-[52px] lg:text-base"
                >
                  {status === 'updating'
                    ? 'Updating password...'
                    : 'Update Password'}
                </button>
              </form>
            </>
          ) : null}

          {status === 'success' ? (
            <div className="space-y-6 text-center">
              <h1 className="text-2xl font-bold text-[#0F1B35]">
                Password updated successfully
              </h1>
              <p className="text-sm leading-relaxed text-[#64748B]">
                {signOutFailed
                  ? 'Your password was changed. Please return to login to continue.'
                  : 'You can now sign in with your new password.'}
              </p>
              <button
                type="button"
                onClick={() => navigate(LOGIN_PATH, { replace: true })}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.65)] lg:h-[52px]"
              >
                Return to Login
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ResetPasswordPage
