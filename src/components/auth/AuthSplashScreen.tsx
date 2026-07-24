import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

type AuthSplashScreenProps = {
  className?: string
  fadingOut?: boolean
}

const BLOCKS = [
  { x: -48, y: -40, delay: 0 },
  { x: 10, y: -50, delay: 30 },
  { x: 52, y: -32, delay: 60 },
  { x: -54, y: 2, delay: 85 },
  { x: 58, y: 8, delay: 110 },
  { x: -40, y: 42, delay: 135 },
  { x: 8, y: 54, delay: 160 },
  { x: 44, y: 38, delay: 185 },
  { x: -6, y: -6, delay: 210 },
] as const

/**
 * Full-screen DREVORA auth splash shown while session + membership resolve.
 * Controlled by auth readiness — not a timed marketing intro.
 */
export function AuthSplashScreen({
  className,
  fadingOut = false,
}: AuthSplashScreenProps) {
  return (
    <div
      className={cn(
        'auth-splash fixed inset-0 z-[100] flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#FFFFFF_0%,#F4F9FF_48%,#EAF4FF_100%)] px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-opacity duration-300 ease-out',
        fadingOut && 'pointer-events-none opacity-0',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading DREVORA"
    >
      <div className="relative flex w-full max-w-[17rem] flex-col items-center">
        <div className="auth-splash-stage relative flex size-[10.5rem] items-center justify-center sm:size-[11.5rem]">
          {BLOCKS.map((block, index) => (
            <span
              key={index}
              className="auth-splash-block absolute size-3.5 rounded-[5px] bg-[#2563EB] sm:size-4 sm:rounded-[6px]"
              style={
                {
                  '--splash-x': `${block.x}px`,
                  '--splash-y': `${block.y}px`,
                  '--splash-delay': `${block.delay}ms`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          ))}

          <img
            src="/pwa-512x512.png"
            alt=""
            width={512}
            height={512}
            className="auth-splash-mark relative z-[1] h-[8.75rem] w-[8.75rem] object-contain sm:h-[9.5rem] sm:w-[9.5rem]"
            draggable={false}
          />
        </div>

        <p className="auth-splash-wordmark mt-[18px] text-[1.05rem] font-semibold tracking-[0.28em] text-[#1E3A6E]">
          DREVORA
        </p>
      </div>
    </div>
  )
}
