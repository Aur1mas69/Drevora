import drevoraLogoFull from '@/assets/drevora-logo-full.png'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/contexts/AuthContext'
import { useRoleBasedAuthRedirect } from '@/hooks/useRoleBasedAuthRedirect'
import { capturePendingPlanFromSearch, readPendingPlanCode } from '@/lib/pendingPlan'
import {
  getSubscriptionPlan,
  LANDING_PRICING_URL,
  type SubscriptionPlanCode,
} from '@/lib/subscriptionPlans'
import {
  authService,
  AuthServiceError,
} from '@/services/authService'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'

const previewInputClassName =
  'h-11 w-full rounded-xl border border-sky-200/80 bg-white/75 pl-10 pr-4 text-sm text-[#0F1B35] shadow-sm outline-none placeholder:text-slate-400 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 lg:h-[60px] lg:rounded-[10px] lg:border-sky-300/85 lg:bg-white/80 lg:pl-12 lg:pr-5 lg:text-base lg:focus:ring-[3px] lg:focus:ring-[#2563EB]/28'

function OrbitDecoration() {
  return (
    <div
      className="relative mx-auto hidden h-[125px] w-[145px] shrink-0 lg:block"
      aria-hidden
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute size-[118px] rounded-full border border-sky-300/35" />
        <div className="absolute size-[88px] rounded-full border border-sky-300/45" />
        <div className="absolute size-[58px] rounded-full border border-sky-400/50" />
        <div className="absolute size-3 rounded-full bg-[#2563EB] shadow-[0_0_0_4px_rgba(37,99,235,0.12)]" />
        <div className="absolute top-[6px] left-1/2 size-2 -translate-x-1/2 rounded-full bg-[#3B82F6]/75" />
        <div className="absolute top-[22px] right-[18px] size-1.5 rounded-full bg-[#60A5FA]/80" />
        <div className="absolute bottom-[18px] left-[20px] size-2 rounded-full bg-[#2563EB]/70" />
        <div className="absolute right-[8px] bottom-[34px] size-1.5 rounded-full bg-[#93C5FD]/90" />
      </div>
    </div>
  )
}

function LoginTwilightPreviewPage() {
  const { setAuthenticatedSession } = useAuth()
  const location = useLocation()
  useRoleBasedAuthRedirect()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedPlanCode, setSelectedPlanCode] =
    useState<SubscriptionPlanCode | null>(() => readPendingPlanCode())

  useEffect(() => {
    const captured = capturePendingPlanFromSearch(location.search)
    setSelectedPlanCode(captured ?? readPendingPlanCode())
  }, [location.search])

  const selectedPlan = selectedPlanCode
    ? getSubscriptionPlan(selectedPlanCode)
    : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const result = await authService.signIn(email, password)
      // Portal is presentation preference only; shell is chosen by membership role.
      setAuthenticatedSession(result.session, 'admin')
    } catch (error) {
      setErrorMessage(
        error instanceof AuthServiceError
          ? error.message
          : 'Unable to sign in. Please try again.',
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

      <div className="relative z-10 flex min-h-dvh w-full flex-col lg:min-h-screen">
        <div className="mx-auto flex w-full min-h-dvh max-w-[1440px] flex-1 flex-col overflow-y-auto px-4 lg:grid lg:min-h-screen lg:translate-y-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-[25px] lg:overflow-visible lg:px-10 lg:py-0">
          <div className="hidden lg:block lg:-ml-6 lg:justify-self-end lg:pt-[70px]">
            <div className="w-full max-w-[650px] lg:max-w-[695px]">
            <img
              src={drevoraLogoFull}
              alt="DREVORA"
              className="h-auto w-full max-w-full object-contain lg:max-w-[695px]"
            />

            <h1 className="mt-5 text-[2rem] font-bold leading-[1.4] text-[#0F1B35] lg:mt-9 lg:max-w-[640px] lg:text-[40px] lg:leading-[1.18] xl:text-[44px]">
              Manage your fleet, team
              <br />
              and daily operations with
              <br />
              <span className="text-[#2563EB]">DREVORA</span> — all in one place.
            </h1>

            <div className="mt-5 space-y-1 text-lg font-medium text-[#0F1B35] lg:mt-8 lg:space-y-2.5 lg:text-[20px] lg:font-semibold">
              <p>Save time. Reduce paperwork.</p>
              <p className="text-[#2563EB]">
                Keep your transport business moving.
              </p>
            </div>

            <div
              className="mt-5 h-1 w-14 rounded-full bg-[#2563EB] lg:mt-8 lg:h-[3px] lg:w-[46px]"
              aria-hidden
            />

            <p className="mt-5 text-base leading-relaxed text-[#334155] lg:mt-8 lg:max-w-[560px] lg:text-[17px] lg:leading-[1.65]">
              DREVORA helps transport companies manage vehicles, workers,
              timesheets, holiday requests, vehicle checks, driver reports and
              compliance from one simple platform.
            </p>
          </div>
          </div>

          <div className="my-auto flex w-full min-w-0 flex-col items-center py-5 lg:my-0 lg:ml-[68px] lg:min-w-0 lg:justify-self-start lg:items-center lg:justify-start lg:py-[60px]">
            <img
              src={drevoraLogoFull}
              alt="DREVORA"
              className="mb-5 h-auto w-full max-w-[240px] shrink-0 object-contain lg:hidden"
            />
          <div
            className="w-full min-w-0 max-w-[440px] rounded-[22px] border border-sky-200/70 bg-white/72 px-6 py-7 shadow-[0_24px_64px_-28px_rgba(56,120,190,0.35)] backdrop-blur-sm sm:px-8 sm:py-8 lg:flex lg:min-h-[760px] lg:min-w-0 lg:w-[560px] lg:max-w-[560px] lg:flex-col lg:rounded-[38px] lg:border-white/80 lg:bg-white/58 lg:px-[50px] lg:py-[46px] lg:shadow-[0_40px_100px_-32px_rgba(100,130,170,0.45)] lg:ring-1 lg:ring-sky-200/50 lg:backdrop-blur-md"
            aria-label="Login card preview"
          >
            <div className="flex w-full min-w-0 max-w-full flex-col items-center lg:h-full lg:min-w-0 lg:flex-1 lg:overflow-x-hidden lg:p-0">
              <OrbitDecoration />

              <h2 className="max-w-full min-w-0 text-center text-2xl font-bold text-[#0F1B35] lg:mt-8 lg:max-w-full lg:min-w-0 lg:text-[32px] lg:leading-tight">
                Account Login
              </h2>
              <p className="mt-2 max-w-full min-w-0 text-center text-sm leading-relaxed text-[#64748B] lg:mt-4 lg:max-w-full lg:min-w-0 lg:text-[17px] lg:leading-relaxed lg:text-[#5B6B82]">
                Welcome back! Please enter your details to continue.
              </p>

              {selectedPlan ? (
                <div className="mt-4 w-full rounded-xl border border-sky-200/80 bg-sky-50/80 px-3.5 py-3 text-left lg:mt-5">
                  <p className="text-sm font-medium text-[#0F1B35]">
                    Selected plan:{' '}
                    <span className="font-semibold">{selectedPlan.displayName}</span>
                  </p>
                  <a
                    href={LANDING_PRICING_URL}
                    className="mt-1 inline-block text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    Change plan
                  </a>
                </div>
              ) : null}

              <form
                className="mt-6 w-full min-w-0 max-w-full space-y-5 lg:mt-10 lg:space-y-7"
                onSubmit={handleSubmit}
              >
                <div className="space-y-2 lg:space-y-2.5">
                  <label
                    htmlFor="preview-login-email"
                    className="block text-sm font-medium text-[#0F1B35] lg:text-base lg:font-semibold"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#64748B] lg:left-4 lg:size-5"
                      aria-hidden
                    />
                    <input
                      id="preview-login-email"
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
                      className={previewInputClassName}
                      aria-label="Email Address"
                    />
                  </div>
                </div>

                <div className="space-y-2 lg:space-y-2.5">
                  <label
                    htmlFor="preview-login-password"
                    className="block text-sm font-medium text-[#0F1B35] lg:text-base lg:font-semibold"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#64748B] lg:left-4 lg:size-5"
                      aria-hidden
                    />
                    <input
                      id="preview-login-password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(event) => {
                        setErrorMessage(null)
                        setPassword(event.target.value)
                      }}
                      autoComplete="current-password"
                      required
                      className={`${previewInputClassName} pr-10 lg:pr-12`}
                      aria-label="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                      className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm text-[#64748B] transition-colors hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/28 lg:right-4"
                    >
                      {showPassword ? (
                        <EyeOff
                          className="size-4 lg:size-5"
                          aria-hidden
                        />
                      ) : (
                        <Eye className="size-4 lg:size-5" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1 lg:flex-nowrap lg:py-1">
                  <label
                    htmlFor="preview-remember"
                    className="flex min-w-0 max-w-full cursor-pointer items-center gap-2"
                  >
                    <Checkbox
                      id="preview-remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked === true)
                      }
                      className="size-4 shrink-0 rounded-[4px] border-sky-300/90 bg-white/80 data-checked:border-[#2563EB] data-checked:bg-[#2563EB] data-checked:text-white"
                    />
                    <span className="text-sm text-[#5B6B82] select-none">
                      Remember me
                    </span>
                  </label>
                  <button
                    type="button"
                    className="shrink-0 text-sm font-medium text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
                  >
                    Forgot Password?
                  </button>
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
                  className="h-11 w-full rounded-xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-12px_rgba(37,99,235,0.75)] active:translate-y-0 active:shadow-[0_8px_18px_-12px_rgba(37,99,235,0.55)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 lg:h-[60px] lg:rounded-[10px] lg:bg-gradient-to-r lg:from-[#1D6FE8] lg:to-[#1554D9] lg:text-[19px] lg:font-semibold lg:shadow-[0_18px_44px_-14px_rgba(37,99,235,0.55)] lg:hover:shadow-[0_22px_50px_-14px_rgba(37,99,235,0.62)] lg:active:shadow-[0_14px_32px_-14px_rgba(37,99,235,0.48)]"
                >
                  {isSubmitting ? 'Logging in...' : 'Log In'}
                </button>
              </form>

              <div className="mt-6 w-full min-w-0 max-w-full pt-2 lg:mt-auto lg:pt-12">
                <div className="flex w-full items-center gap-4 lg:gap-6">
                  <div className="h-px min-w-0 flex-1 bg-sky-200/70 lg:bg-sky-200/80" aria-hidden />
                  <span className="shrink-0 text-xs font-medium uppercase tracking-[0.12em] text-[#94A3B8]">
                    or
                  </span>
                  <div className="h-px min-w-0 flex-1 bg-sky-200/70 lg:bg-sky-200/80" aria-hidden />
                </div>

                <a
                  href="https://drevora.app"
                  className="mt-6 block w-full text-sm font-medium text-[#64748B] transition-colors hover:text-[#2563EB] lg:mt-7 lg:text-[17px] lg:font-medium lg:text-[#5B6B82]"
                >
                  ← Back to menu
                </a>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginTwilightPreviewPage
