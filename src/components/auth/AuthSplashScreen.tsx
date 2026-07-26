import { cn } from '@/lib/utils'

type AuthSplashScreenProps = {
  className?: string
  fadingOut?: boolean
}

/**
 * Full-screen, theme-aware DREVORA loading experience.
 *
 * Shown while auth/session/membership state resolves and as the Suspense
 * fallback for lazy-loaded routes (see RouteLoadingFallback, AuthBootstrapGate,
 * MembershipLoadingScreen, CompanyOnboardingPage — all render this single
 * component). Controlled entirely by caller readiness, never a timed intro.
 *
 * Theme reactivity is pure CSS: Admin/Office resolves via Tailwind's `.dark`
 * class (see src/lib/theme.ts) and Worker resolves via `.worker-dark` (see
 * src/lib/workerAppearance.ts) — both are ancestor classes on <html>, so the
 * `:where(.dark, .worker-dark) .auth-splash*` rules in src/index.css apply
 * immediately with no JS theme detection needed here.
 */
export function AuthSplashScreen({
  className,
  fadingOut = false,
}: AuthSplashScreenProps) {
  return (
    <div
      className={cn(
        'auth-splash fixed inset-0 z-[100] flex min-h-dvh w-full items-center justify-center overflow-hidden px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity duration-300 ease-out',
        fadingOut && 'pointer-events-none opacity-0',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading DREVORA"
    >
      <div className="relative flex w-full max-w-[18rem] flex-col items-center">
        <div className="relative flex items-center justify-center">
          <span className="auth-splash-halo absolute inset-[-0.9rem] rounded-full" aria-hidden="true" />

          <svg
            className="auth-splash-mark relative z-[1] h-[5.5rem] w-[5.5rem] sm:h-[6rem] sm:w-[6rem] lg:h-[6.75rem] lg:w-[6.75rem]"
            viewBox="0 0 72 72"
            fill="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient
                id="authSplashMarkGradient"
                x1="7"
                y1="11"
                x2="58"
                y2="62"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#38BDF8" />
                <stop offset="0.48" stopColor="#4F46E5" />
                <stop offset="1" stopColor="#7C3AED" />
              </linearGradient>
              <linearGradient
                id="authSplashMarkRoad"
                x1="8"
                y1="50"
                x2="47"
                y2="42"
                gradientUnits="userSpaceOnUse"
              >
                <stop stopColor="#CBD5E1" />
                <stop offset="1" stopColor="#F8FBFF" />
              </linearGradient>
            </defs>
            <path
              d="M7 12h31.9C54.4 12 65.5 21.8 65.5 35.3S54.4 58.5 38.9 58.5H18.9l6.4-12.9h13.6c7.1 0 12.8-4.4 12.8-10.3S46 24.9 38.9 24.9H16.6L7 12Z"
              fill="url(#authSplashMarkGradient)"
            />
            <path
              d="M11 59.1c6.6-13.7 17.9-20.9 34-21.8l-5.4 10.8c-10.3 1.2-17.5 6.2-21.6 15.1H7.7l3.3-4.1Z"
              fill="url(#authSplashMarkRoad)"
            />
            <path
              d="M19.9 56.7c4.2-6.3 10.2-10 17.9-11.1l-1.6 3.3c-5.8 1.2-10.3 4.1-13.5 8.7l-1.9 3.6h-4l3.1-4.5Z"
              fill="#1D4ED8"
              opacity="0.78"
            />
            <path
              d="M26.8 57.9c1.9-2 4.2-3.5 6.8-4.3L31 59c-1.2.5-2.3 1.3-3.2 2.2H24l2.8-3.3Z"
              fill="#7C3AED"
              opacity="0.82"
            />
          </svg>
        </div>

        <p className="auth-splash-word mt-4 text-[1.3rem] font-bold tracking-[0.32em]">
          DREVORA
        </p>
        <p className="auth-splash-tagline mt-1 text-[0.65rem] font-semibold tracking-[0.22em]">
          FLEET &amp; TEAM MANAGEMENT
        </p>

        <div
          className="auth-splash-progress mt-6 h-1 w-28 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <div className="auth-splash-progress-bar h-full w-full rounded-full" />
        </div>

        <p className="auth-splash-message mt-3 text-[0.75rem] font-medium">
          Loading your workspace…
        </p>
      </div>
    </div>
  )
}
