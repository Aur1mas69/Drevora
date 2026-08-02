import drevoraLogoFull from '@/assets/drevora-logo-full.png'
import {
  authService,
  AuthServiceError,
} from '@/services/authService'
import { LOGIN_PATH } from '@/lib/membershipRoles'
import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

const authInputClassName =
  'h-11 w-full rounded-xl border border-sky-200/80 bg-white/75 pl-10 pr-4 text-sm text-[#0F1B35] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 lg:h-[60px] lg:rounded-[10px] lg:border-sky-300/85 lg:bg-white/80 lg:pl-12 lg:pr-5 lg:text-base lg:focus:ring-[3px] lg:focus:ring-[#2563EB]/28'

const SUCCESS_MESSAGE =
  'If an account exists for this email address, a password reset link has been sent. Please check your inbox and spam folder.'

function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const redirectTo = `${window.location.origin}/reset-password`
      await authService.requestPasswordReset(email, redirectTo)
      setSubmitted(true)
    } catch (error) {
      setErrorMessage(
        error instanceof AuthServiceError
          ? error.message
          : 'Unable to send a reset link right now. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-dvh w-full lg:min-h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/login-office-background.png')" }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-white/64 via-white/51 to-sky-100/45"
        aria-hidden
      />

      <div className="relative z-10 flex min-h-dvh w-full flex-col items-center justify-center px-4 py-8">
        <img
          src={drevoraLogoFull}
          alt="DREVORA"
          className="mb-6 h-auto w-full max-w-[240px] object-contain"
        />

        <div
          className="w-full max-w-[440px] rounded-[22px] border border-sky-200/70 bg-white/72 px-6 py-7 shadow-[0_24px_64px_-28px_rgba(56,120,190,0.35)] backdrop-blur-sm sm:px-8 sm:py-8 lg:max-w-[480px] lg:rounded-[28px] lg:bg-white/58 lg:px-10 lg:py-10 lg:shadow-[0_40px_100px_-32px_rgba(100,130,170,0.45)] lg:ring-1 lg:ring-sky-200/50"
          aria-label="Forgot password"
        >
          <h1 className="text-center text-2xl font-bold text-[#0F1B35] lg:text-[28px]">
            Reset your password
          </h1>
          <p className="mt-3 text-center text-sm leading-relaxed text-[#64748B] lg:text-[15px]">
            Enter your email address and we'll send you a secure password reset
            link.
          </p>

          {submitted ? (
            <div className="mt-8 space-y-6">
              <p
                role="status"
                className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm leading-relaxed text-[#0F1B35]"
              >
                {SUCCESS_MESSAGE}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false)
                  setErrorMessage(null)
                }}
                className="h-11 w-full rounded-xl border border-sky-200 bg-white/80 text-sm font-semibold text-[#2563EB] transition-colors hover:bg-sky-50 lg:h-[52px]"
              >
                Send another link
              </button>
              <Link
                to={LOGIN_PATH}
                className="block w-full text-center text-sm font-medium text-[#64748B] transition-colors hover:text-[#2563EB]"
              >
                ← Back to Login
              </Link>
            </div>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label
                  htmlFor="forgot-password-email"
                  className="block text-sm font-medium text-[#0F1B35] lg:font-semibold"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#64748B] lg:left-4 lg:size-5"
                    aria-hidden
                  />
                  <input
                    id="forgot-password-email"
                    type="email"
                    name="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => {
                      setErrorMessage(null)
                      setEmail(event.target.value)
                    }}
                    autoComplete="email"
                    required
                    className={authInputClassName}
                    aria-label="Email Address"
                  />
                </div>
              </div>

              {errorMessage ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-snug text-red-600"
                >
                  {errorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.65)] transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 lg:h-[52px] lg:text-base"
              >
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
              </button>

              <Link
                to={LOGIN_PATH}
                className="block w-full text-center text-sm font-medium text-[#64748B] transition-colors hover:text-[#2563EB]"
              >
                ← Back to Login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordPage
