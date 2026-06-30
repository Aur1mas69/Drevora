import { HERO_BACKGROUND_FALLBACK } from '@/lib/getHeroBackground'
import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'

const LANDING_HERO_BACKGROUND = HERO_BACKGROUND_FALLBACK

export function HeroBackground() {
  const reduceMotion = useReducedMotion()
  const [backgroundSrc, setBackgroundSrc] = useState(LANDING_HERO_BACKGROUND)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <img
        src={backgroundSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={() => {
          if (backgroundSrc !== HERO_BACKGROUND_FALLBACK) {
            setBackgroundSrc(HERO_BACKGROUND_FALLBACK)
          }
        }}
      />

      <div className="absolute inset-0 bg-gradient-to-br from-[#EFF6FF]/88 via-[#DBEAFE]/78 to-[#EFF6FF]/92" />

      <motion.div
        className="absolute -top-32 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-[#93C5FD]/25 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, 24, -12, 0],
                y: [0, 16, -8, 0],
                scale: [1, 1.04, 0.98, 1],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : { duration: 18, repeat: Infinity, ease: 'easeInOut' }
        }
      />

      <motion.div
        className="absolute top-[38%] -right-24 size-[420px] rounded-full bg-[#BFDBFE]/30 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : {
                x: [0, -20, 12, 0],
                y: [0, -14, 10, 0],
                scale: [1, 0.96, 1.03, 1],
              }
        }
        transition={
          reduceMotion
            ? undefined
            : { duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 2 }
        }
      />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.08),transparent_55%)]" />
    </div>
  )
}
