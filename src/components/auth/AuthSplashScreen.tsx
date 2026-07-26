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
 *
 * The mark rendered here is the exact, unmodified official DREVORA asset
 * (`/drevora-logo-DNa5g0Qw.png`) already used by the Admin sidebar header —
 * not a recreated/approximate logo. It already contains the "DREVORA"
 * wordmark and "FLEET & TEAM MANAGEMENT" tagline, so no separate text is
 * rendered for those. Only the wrapping frame/halo animates; the image
 * itself is never rotated, recoloured or distorted.
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
      <div className="relative flex w-full max-w-[22rem] flex-col items-center px-2">
        <div className="relative flex items-center justify-center">
          <span className="auth-splash-halo absolute inset-[-1.25rem] rounded-[2rem]" aria-hidden="true" />

          {/* Official DREVORA mark + wordmark — identical asset used by the
              Admin sidebar header (see SidebarBrand in AdminLayout.tsx). The
              image itself is never animated, recoloured or distorted; only
              the wrapping frame/halo below it moves. */}
          <div className="auth-splash-mark-frame relative z-[1]">
            <img
              src="/drevora-logo-DNa5g0Qw.png"
              alt="DREVORA"
              width={891}
              height={199}
              className="block h-auto w-[260px] object-contain sm:w-[290px] lg:w-[320px]"
              draggable={false}
            />
          </div>
        </div>

        <div
          className="auth-splash-progress mt-8 h-1 w-28 overflow-hidden rounded-full"
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
