import drevoraMark from '@/assets/drevora-mark.png'
import { cn } from '@/lib/utils'
import type { CSSProperties } from 'react'

type AuthSplashScreenProps = {
  className?: string
  fadingOut?: boolean
}

const BLOCKS = [
  { x: -42, y: -36, delay: 0 },
  { x: 8, y: -44, delay: 40 },
  { x: 46, y: -28, delay: 80 },
  { x: -48, y: 2, delay: 110 },
  { x: 52, y: 6, delay: 140 },
  { x: -36, y: 38, delay: 170 },
  { x: 6, y: 48, delay: 200 },
  { x: 40, y: 34, delay: 230 },
  { x: -8, y: -8, delay: 260 },
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
        'auth-splash fixed inset-0 z-[100] flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[linear-gradient(160deg,#FFFFFF_0%,#F4F9FF_48%,#EAF4FF_100%)] transition-opacity duration-300 ease-out',
        fadingOut && 'pointer-events-none opacity-0',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label="Loading DREVORA"
    >
      <div className="relative flex w-full max-w-[18rem] flex-col items-center px-6">
        <div className="auth-splash-stage relative flex size-[7.5rem] items-center justify-center sm:size-[8.5rem]">
          {BLOCKS.map((block, index) => (
            <span
              key={index}
              className="auth-splash-block absolute size-3 rounded-[5px] bg-[#2563EB] sm:size-3.5 sm:rounded-[6px]"
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
            src={drevoraMark}
            alt=""
            className="auth-splash-mark relative z-[1] h-[4.75rem] w-auto object-contain sm:h-[5.5rem]"
            draggable={false}
          />
        </div>

        <p className="auth-splash-wordmark mt-5 text-[0.95rem] font-semibold tracking-[0.28em] text-[#1E3A6E]">
          DREVORA
        </p>
      </div>
    </div>
  )
}
