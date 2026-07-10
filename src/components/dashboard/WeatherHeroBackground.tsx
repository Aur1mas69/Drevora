import {
  getHeroBackground,
  getHeroBackgroundPosition,
  HERO_BACKGROUND_FALLBACK,
  HERO_IMAGE_BLUE_OVERLAY,
  HERO_IMAGE_DARK_OVERLAY,
} from '@/lib/getHeroBackground'
import type { WeatherCondition } from '@/services/weatherService'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'

type WeatherHeroBackgroundProps = {
  weatherCondition: WeatherCondition | null
  isNight: boolean
}

export function WeatherHeroBackground({
  weatherCondition,
  isNight,
}: WeatherHeroBackgroundProps) {
  const preferredSrc = useMemo(
    () => getHeroBackground(weatherCondition, isNight),
    [isNight, weatherCondition],
  )

  const backgroundPosition = useMemo(
    () => getHeroBackgroundPosition(weatherCondition, isNight),
    [isNight, weatherCondition],
  )

  const [activeSrc, setActiveSrc] = useState(preferredSrc)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    setActiveSrc(preferredSrc)
    setFailedSrc(null)
  }, [preferredSrc])

  const backgroundUrl =
    failedSrc === activeSrc ? HERO_BACKGROUND_FALLBACK : activeSrc

  const motionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { duration: 0.85, ease: 'easeInOut' as const }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence mode="sync">
        <motion.div
          key={backgroundUrl}
          className="absolute inset-0 max-md:transition-none md:transition-[background-position] md:duration-1000 md:ease-out"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition,
            backgroundRepeat: 'no-repeat',
          }}
          initial={{ opacity: prefersReducedMotion ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: prefersReducedMotion ? 1 : 0 }}
          transition={motionTransition}
        />
      </AnimatePresence>

      <img
        src={backgroundUrl}
        alt=""
        className="hidden"
        onError={() => {
          if (backgroundUrl !== HERO_BACKGROUND_FALLBACK) {
            setFailedSrc(backgroundUrl)
          }
        }}
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
