export type WeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'snow' | 'night'

export type WeatherSnapshot = {
  temperatureC: number
  conditionLabel: string
  condition: WeatherCondition
  icon: string
  weatherCode: number
}

type GeocodeResult = {
  latitude: number
  longitude: number
  name: string
  country?: string
  admin1?: string
}

type WeatherCacheEntry = {
  fetchedAt: number
  snapshot: WeatherSnapshot
}

const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_PREFIX = 'drevora-weather:'

function cacheKey(location: string): string {
  return `${CACHE_PREFIX}${location.trim().toLowerCase()}`
}

function readCache(location: string): WeatherSnapshot | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(location))
    if (!raw) return null

    const parsed = JSON.parse(raw) as WeatherCacheEntry
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheKey(location))
      return null
    }

    return {
      ...parsed.snapshot,
      weatherCode: parsed.snapshot.weatherCode ?? 0,
    }
  } catch {
    return null
  }
}

function writeCache(location: string, snapshot: WeatherSnapshot): void {
  try {
    const entry: WeatherCacheEntry = {
      fetchedAt: Date.now(),
      snapshot,
    }
    sessionStorage.setItem(cacheKey(location), JSON.stringify(entry))
  } catch {
    // Ignore quota errors — weather still displays for this session.
  }
}

function parseLocationQuery(location: string): { name: string; countryCode?: string } {
  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length >= 2) {
    const countryPart = parts[parts.length - 1]
    const normalizedCountry = countryPart.toLowerCase()
    const countryCode =
      normalizedCountry === 'uk' || normalizedCountry === 'united kingdom' || normalizedCountry === 'gb'
        ? 'GB'
        : countryPart.length === 2
          ? countryPart.toUpperCase()
          : undefined

    return {
      name: parts.slice(0, -1).join(', '),
      countryCode,
    }
  }

  return { name: location.trim() }
}

function mapWeatherCode(
  code: number,
  isNight = false,
): Pick<WeatherSnapshot, 'condition' | 'conditionLabel' | 'icon'> {
  if (code === 0) {
    if (isNight) {
      return { condition: 'night', conditionLabel: 'Clear', icon: '🌙' }
    }
    return { condition: 'sunny', conditionLabel: 'Sunny', icon: '☀️' }
  }

  if (code === 1 || code === 2 || code === 3 || code === 45 || code === 48) {
    return { condition: 'cloudy', conditionLabel: 'Cloudy', icon: '☁️' }
  }

  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  ) {
    return { condition: 'rain', conditionLabel: 'Rain', icon: '🌧️' }
  }

  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return { condition: 'snow', conditionLabel: 'Snow', icon: '❄️' }
  }

  return { condition: 'cloudy', conditionLabel: 'Cloudy', icon: '☁️' }
}

export function displayWeatherSnapshot(
  snapshot: WeatherSnapshot,
  isNight: boolean,
): WeatherSnapshot {
  const mapped = mapWeatherCode(snapshot.weatherCode, isNight)
  return {
    ...snapshot,
    ...mapped,
  }
}

async function geocodeSearch(params: URLSearchParams): Promise<GeocodeResult | null> {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
  )

  if (!response.ok) {
    if (import.meta.env.DEV) {
      console.warn(
        '[weatherService] geocode failed:',
        response.status,
        `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`,
      )
    }
    return null
  }

  const data = (await response.json()) as { results?: GeocodeResult[] }
  return data.results?.[0] ?? null
}

async function geocodeLocation(location: string): Promise<GeocodeResult | null> {
  const { name, countryCode } = parseLocationQuery(location)
  const params = new URLSearchParams({
    name,
    count: '1',
    language: 'en',
    format: 'json',
  })

  if (countryCode) {
    params.set('countryCode', countryCode)
  }

  const primary = await geocodeSearch(params)
  if (primary) return primary

  // Fallback: retry without country filter when the configured location is noisy.
  if (countryCode || name !== location.trim()) {
    const fallbackParams = new URLSearchParams({
      name: name || location.trim(),
      count: '1',
      language: 'en',
      format: 'json',
    })
    return geocodeSearch(fallbackParams)
  }

  return null
}

async function fetchCurrentWeather(
  latitude: number,
  longitude: number,
  isNight = false,
): Promise<WeatherSnapshot | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
    timezone: 'auto',
  })

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?${params.toString()}`
  const response = await fetch(forecastUrl)
  if (!response.ok) {
    if (import.meta.env.DEV) {
      console.warn('[weatherService] forecast failed:', response.status, forecastUrl)
    }
    return null
  }

  const data = (await response.json()) as {
    current?: {
      temperature_2m?: number
      weather_code?: number
    }
  }

  const temperature = data.current?.temperature_2m
  const weatherCode = data.current?.weather_code

  if (typeof temperature !== 'number' || typeof weatherCode !== 'number') {
    return null
  }

  const mapped = mapWeatherCode(weatherCode, isNight)
  return {
    temperatureC: Math.round(temperature),
    weatherCode,
    ...mapped,
  }
}

export async function getWeatherForLocation(
  location: string,
  options?: { isNight?: boolean },
): Promise<WeatherSnapshot | null> {
  const trimmed = location.trim()
  if (!trimmed) return null

  const cached = readCache(trimmed)
  if (cached) {
    return displayWeatherSnapshot(cached, options?.isNight ?? false)
  }

  const geocoded = await geocodeLocation(trimmed)
  if (!geocoded) return null

  const snapshot = await fetchCurrentWeather(
    geocoded.latitude,
    geocoded.longitude,
    options?.isNight ?? false,
  )
  if (!snapshot) return null

  writeCache(trimmed, snapshot)
  return snapshot
}

export type WeatherHeroTheme =
  | 'default'
  | 'sunny'
  | 'partly-cloudy'
  | 'cloudy'
  | 'rain'
  | 'night'
  | 'snow'

export function resolveWeatherHeroTheme(
  weather: WeatherSnapshot | null,
  date = new Date(),
  timeZone = 'Europe/London',
): WeatherHeroTheme {
  const hour = getHourInTimeZone(date, timeZone)
  const isNight = hour >= 22 || hour < 5

  if (!weather) {
    return isNight ? 'night' : 'default'
  }

  if (weather.condition === 'snow') {
    return 'snow'
  }

  if (weather.condition === 'rain') {
    return 'rain'
  }

  if (weather.condition === 'night' || (isNight && weather.weatherCode === 0)) {
    return 'night'
  }

  if (isNight) {
    return 'night'
  }

  if (weather.weatherCode === 0 || weather.condition === 'sunny') {
    return 'sunny'
  }

  if (weather.weatherCode === 1) {
    return 'partly-cloudy'
  }

  if (weather.weatherCode === 2 || weather.weatherCode === 3) {
    return 'cloudy'
  }

  if (weather.condition === 'cloudy') {
    return 'cloudy'
  }

  return 'default'
}

export type DashboardBackgroundMood = 'default' | 'sunny' | 'cloudy' | 'rain' | 'night'

export function resolveDashboardBackgroundMood(
  weather: WeatherSnapshot | null,
  date = new Date(),
  timeZone = 'Europe/London',
): DashboardBackgroundMood {
  const hour = getHourInTimeZone(date, timeZone)
  if (hour >= 22 || hour < 5) return 'night'
  if (!weather) return 'default'

  switch (weather.condition) {
    case 'sunny':
    case 'night':
      return hour >= 22 || hour < 5 ? 'night' : 'sunny'
    case 'rain':
      return 'rain'
    case 'snow':
      return 'cloudy'
    case 'cloudy':
    default:
      return 'cloudy'
  }
}

function getHourInTimeZone(date: Date, timeZone: string): number {
  try {
    const hourPart = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(date)

    return Number(hourPart.find((part) => part.type === 'hour')?.value ?? date.getHours())
  } catch {
    return date.getHours()
  }
}

export function isNightHours(date = new Date(), timeZone = 'Europe/London'): boolean {
  const hour = getHourInTimeZone(date, timeZone)
  return hour >= 22 || hour < 5
}
