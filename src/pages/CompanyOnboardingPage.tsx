import { AuthSplashScreen } from '@/components/auth/AuthSplashScreen'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  formatPlanVehicleLimit,
  formatPlanWorkerLimit,
  getSubscriptionPlan,
  LANDING_PRICING_URL,
} from '@/lib/subscriptionPlans'
import { OFFICE_HOME_PATH } from '@/lib/membershipRoles'
import { readPendingPlanCode } from '@/lib/pendingPlan'
import {
  CompanyPlanServiceError,
  createCompanyWithPendingTrialPlan,
} from '@/services/companyPlanService'
import {
  NO_ACTIVE_MEMBERSHIP_MESSAGE,
  resolveCurrentCompanyMembership,
} from '@/services/companyMembershipService'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

function CompanyOnboardingPage() {
  const { isAuthenticated, isAuthLoading, signOut } = useAuth()
  const { refreshCompanySettings, companyReady } = useCompanySettings()
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [isChecking, setIsChecking] = useState(true)
  const [isUnlinked, setIsUnlinked] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pendingPlanCode = readPendingPlanCode()
  const plan = pendingPlanCode ? getSubscriptionPlan(pendingPlanCode) : null

  useEffect(() => {
    let cancelled = false

    async function checkMembership() {
      if (!isAuthenticated) {
        if (!cancelled) {
          setIsChecking(false)
          setIsUnlinked(false)
        }
        return
      }

      setIsChecking(true)
      const resolution = await resolveCurrentCompanyMembership({ force: true })
      if (cancelled) return

      if (resolution.status === 'ready') {
        setIsUnlinked(false)
        setIsChecking(false)
        navigate(OFFICE_HOME_PATH, { replace: true })
        return
      }

      setIsUnlinked(resolution.status === 'unlinked')
      if (resolution.status !== 'unlinked') {
        setErrorMessage(resolution.message || NO_ACTIVE_MEMBERSHIP_MESSAGE)
      }
      setIsChecking(false)
    }

    if (!isAuthLoading) {
      void checkMembership()
    }

    return () => {
      cancelled = true
    }
  }, [isAuthLoading, isAuthenticated, navigate])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await createCompanyWithPendingTrialPlan({ companyName })
      refreshCompanySettings()
      navigate(OFFICE_HOME_PATH, { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof CompanyPlanServiceError
          ? error.message
          : 'Unable to create your company. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthLoading || isChecking) {
    return <AuthSplashScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (companyReady) {
    return <Navigate to={OFFICE_HOME_PATH} replace />
  }

  if (!isUnlinked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F6F9FF] px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">Account access</h1>
          <p className="mt-2 text-sm text-slate-600">
            {errorMessage ?? NO_ACTIVE_MEMBERSHIP_MESSAGE}
          </p>
          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#F6F9FF] px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl border border-sky-200/70 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
          Free trial setup
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[#0F1B35]">
          Create your company
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your selected plan will be saved with your company. Payment setup is completed
          separately — no card details are required here.
        </p>

        {plan ? (
          <div className="mt-5 rounded-xl border border-sky-100 bg-[#F8FBFF] px-4 py-4">
            <p className="text-sm font-semibold text-[#0F1B35]">{plan.displayName}</p>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              <li>{formatPlanVehicleLimit(plan)}</li>
              <li>{formatPlanWorkerLimit(plan)}</li>
              <li>1 month free</li>
              <li>{plan.priceDisplay} after the trial</li>
            </ul>
            <a
              href={LANDING_PRICING_URL}
              className="mt-3 inline-block text-sm font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              Change plan
            </a>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <p>No plan selected yet.</p>
            <a
              href={LANDING_PRICING_URL}
              className="mt-2 inline-block font-medium text-[#2563EB] hover:text-[#1D4ED8]"
            >
              Choose a plan on the pricing page
            </a>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              htmlFor="onboarding-company-name"
              className="block text-sm font-medium text-[#0F1B35]"
            >
              Company name
            </label>
            <input
              id="onboarding-company-name"
              name="companyName"
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={companyName}
              onChange={(event) => {
                setErrorMessage(null)
                setCompanyName(event.target.value)
              }}
              className="h-11 w-full rounded-xl border border-sky-200/80 bg-white px-3 text-sm text-[#0F1B35] outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
              placeholder="Your transport company"
              autoComplete="organization"
            />
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
            >
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || !plan}
            className="h-11 w-full rounded-xl bg-[#2563EB] text-sm font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Start free trial'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between gap-3 text-sm">
          <Link to="/login" className="font-medium text-slate-500 hover:text-[#2563EB]">
            Back to login
          </Link>
          <button
            type="button"
            className="font-medium text-slate-500 hover:text-[#2563EB]"
            onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

export default CompanyOnboardingPage
