import {
  getHeroBackground,
  getHeroBackgroundPosition,
  HERO_BACKGROUND_FALLBACK,
  HERO_IMAGE_BLUE_OVERLAY,
  HERO_IMAGE_DARK_OVERLAY,
} from '@/lib/getHeroBackground'
import type { WeatherCondition } from '@/services/weatherService'
import { AnimatePresence, motion } from 'framer-motion'
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

  useEffect(() => {
    setActiveSrc(preferredSrc)
    setFailedSrc(null)
  }, [preferredSrc])

  const backgroundUrl =
    failedSrc === activeSrc ? HERO_BACKGROUND_FALLBACK : activeSrc

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <AnimatePresence mode="sync">
        <motion.div
          key={backgroundUrl}
          className="absolute inset-0 transition-[background-position] duration-1000 ease-out"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition,
            backgroundRepeat: 'no-repeat',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
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
        className="absolute inset-0 transition-[background] duration-1000 ease-out"
        style={{ background: HERO_IMAGE_DARK_OVERLAY }}
      />

      <div
        className="absolute inset-0 transition-[background] duration-1000 ease-out"
        style={{ background: HERO_IMAGE_BLUE_OVERLAY }}
      />
    </div>
  )
}
