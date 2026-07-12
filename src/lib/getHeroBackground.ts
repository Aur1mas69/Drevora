import type { WeatherCondition } from '@/services/weatherService'

/**
 * Dashboard hero background images — place your PNG files here:
 *
 *   public/hero-backgrounds/hero-sunny.jpg
 *   public/hero-backgrounds/hero-cloudy.png
 *   public/hero-backgrounds/hero-rain.png
 *   public/hero-backgrounds/hero-snow.png
 *   public/hero-backgrounds/hero-night.png
 *
 * If a file is missing, the hero falls back to hero-cloudy.png at runtime.
 */

export const HERO_BACKGROUND_FALLBACK = '/hero-backgrounds/hero-cloudy.png'

export const HERO_BACKGROUND_PATHS = {
  sunny: '/hero-backgrounds/hero-sunny.jpg',
  cloudy: '/hero-backgrounds/hero-cloudy.png',
  rain: '/hero-backgrounds/hero-rain.png',
  snow: '/hero-backgrounds/hero-snow.png',
  night: '/hero-backgrounds/hero-night.png',
} as const

export type HeroBackgroundKey = keyof typeof HERO_BACKGROUND_PATHS

/**
 * Maps live weather to the hero background image path.
 *
 * Clear / Sunny → hero-sunny.jpg
 * Clouds / Cloudy / Overcast / Mist / Fog → hero-cloudy.png
 * Rain / Drizzle / Thunderstorm → hero-rain.png
 * Snow / Sleet / Blizzard → hero-snow.png
 * Night time → hero-night.png
 */
export function getHeroBackground(
  weatherCondition: WeatherCondition | null | undefined,
  isNight: boolean,
): string {
  return HERO_BACKGROUND_PATHS[resolveHeroBackgroundKey(weatherCondition, isNight)]
}

export function resolveHeroBackgroundKey(
  weatherCondition: WeatherCondition | null | undefined,
  isNight: boolean,
): HeroBackgroundKey {
  if (weatherCondition === 'snow') {
    return 'snow'
  }

  if (weatherCondition === 'rain') {
    return 'rain'
  }

  if (isNight || weatherCondition === 'night') {
    return 'night'
  }

  if (weatherCondition === 'sunny') {
    return 'sunny'
  }

  return 'cloudy'
}

const HERO_BACKGROUND_POSITION: Record<HeroBackgroundKey, string> = {
  sunny: 'center right',
  cloudy: 'center center',
  rain: 'center center',
  snow: 'center center',
  night: 'center center',
}

export function getHeroBackgroundPosition(
  weatherCondition: WeatherCondition | null | undefined,
  isNight: boolean,
): string {
  const key = resolveHeroBackgroundKey(weatherCondition, isNight)
  return HERO_BACKGROUND_POSITION[key]
}

export const HERO_IMAGE_DARK_OVERLAY = 'rgba(10, 25, 60, 0.08)'

export const HERO_IMAGE_BLUE_OVERLAY =
  'linear-gradient(90deg, rgba(235,245,255,.42), rgba(220,235,255,.18), rgba(20,40,80,.10))'

/** Light overlay for sunny/cloudy/snow; dark overlay for rain/night. */
export function isDarkHeroOverlay(
  weatherCondition: WeatherCondition | null | undefined,
  isNight: boolean,
): boolean {
  if (weatherCondition === 'rain') {
    return true
  }

  return isNight || weatherCondition === 'night'
}
