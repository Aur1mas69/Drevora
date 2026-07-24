import {
  ADMIN_DASHBOARD_HERO_BACKGROUND,
  HERO_IMAGE_BLUE_OVERLAY,
  HERO_IMAGE_DARK_OVERLAY,
} from '@/lib/getHeroBackground'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Admin Dashboard hero background — always `/hero-backgrounds/hero.png`.
 * Not driven by weather, time of day, or user selection.
 */
export function WeatherHeroBackground() {
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${ADMIN_DASHBOARD_HERO_BACKGROUND})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
        initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
        animate={{ opacity: 1 }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.85, ease: 'easeInOut' }
        }
      />

      <div
        className="absolute inset-0 max-md:transition-none md:transition-[background] md:duration-1000 md:ease-out"
        style={{ background: HERO_IMAGE_DARK_OVERLAY }}
      />

      <div
        className="absolute inset-0 max-md:transition-none md:transition-[background] md:duration-1000 md:ease-out"
        style={{ background: HERO_IMAGE_BLUE_OVERLAY }}
      />
    </div>
  )
}
