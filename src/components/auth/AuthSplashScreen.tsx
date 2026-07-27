import { cn } from '@/lib/utils'

type AuthSplashScreenProps = {
  className?: string
  fadingOut?: boolean
}

/**
 * Full-screen, always-Light DREVORA loading experience.
 *
 * Shown while auth/session/membership state resolves and as the Suspense
 * fallback for lazy-loaded routes (see RouteLoadingFallback, AuthBootstrapGate,
 * MembershipLoadingScreen, CompanyOnboardingPage — all render this single
 * component). Controlled entirely by caller readiness, never a timed intro.
 *
 * Always renders the approved Light appearance, on every platform, on
 * every cold PWA launch — this is intentional and matches the native
 * Android/iOS splash background (see index.html and vite.config.ts's PWA
 * manifest). The `.auth-splash*` rules in src/index.css are never qualified
 * by `.dark`/`.worker-dark`, so a saved Worker/Admin Dark preference (or
 * `prefers-color-scheme: dark`) cannot recolour this component. Only the
 * real page — rendered after this screen unmounts — resolves and applies
 * the saved Light/Dark theme.
 *
 * The mark rendered here is the exact, unmodified official DREVORA asset
 * (`/drevora-logo-DNa5g0Qw.png`) already used by the Admin sidebar header —
 * not a recreated/approximate logo. It already contains the "DREVORA"
 * wordmark and "FLEET & TEAM MANAGEMENT" tagline, so no separate text is
 * rendered for those. Only the wrapping frame/shadow animates; the image
 * itself is never rotated, recoloured or distorted. The shadow beneath it is
 * a neutral tone only (no purple/blue colour spill behind the wordmark).
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
          {/* Subtle neutral shadow directly beneath the logo — no colour
              spill behind the text. Sits below the mark (lower z-index,
              rendered first) and only spans the lower portion of the frame,
              never the full halo/frame area. */}
          <span
            className="auth-splash-halo absolute inset-x-[14%] bottom-[-0.35rem] h-5 rounded-full sm:h-6"
            aria-hidden="true"
          />

          {/* Official DREVORA mark + wordmark — identical asset used by the
              Admin sidebar header (see SidebarBrand in AdminLayout.tsx). The
              image itself is never animated, recoloured or distorted; only
              the wrapping frame/shadow below it moves. */}
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
          className="auth-splash-progress mt-8 h-1 w-[8.5rem] overflow-hidden rounded-full"
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
