import { formatCompanyDisplayLocation } from '@/lib/company'
import {
  formatCompanyLocalTime,
  formatCompanyOperationsDate,
  getTimeGreeting,
  isNightHours,
} from '@/lib/greeting'
import { useCompanySettings } from '@/contexts/CompanySettingsContext'
import {
  displayWeatherSnapshot,
  getWeatherForLocation,
  resolveDashboardBackgroundMood,
  type DashboardBackgroundMood,
  type WeatherSnapshot,
} from '@/services/weatherService'
import { useEffect, useMemo, useState } from 'react'

const WEATHER_REFRESH_MS = 30 * 60 * 1000
const WEATHER_RETRY_LIMIT = 1

export type WeatherDisplayState = 'idle' | 'loading' | 'ready' | 'unavailable'

export type FleetOperationsHeaderState = {
  now: Date
  greeting: string
  companyName: string | null
  companyLocation: string | null
  companyTimezone: string
  localTime: string
  operationsDate: string
  weather: WeatherSnapshot | null
  weatherDisplay: WeatherDisplayState
  backgroundMood: DashboardBackgroundMood
  isProfileLoading: boolean
}

function resolveWeatherQueryLocation(
  weatherLocation: string | null | undefined,
  city: string | null | undefined,
  country: string | null | undefined,
): string | null {
  const configured = weatherLocation?.trim()
  if (configured) return configured

  const displayLocation = formatCompanyDisplayLocation(city, country)
  if (displayLocation) return displayLocation

  return city?.trim() || null
}

export function useFleetOperationsHeader(): FleetOperationsHeaderState {
  const { company, timezone, timeFormat, isLoading: isProfileLoading } = useCompanySettings()
  const [now, setNow] = useState(() => new Date())
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [weatherDisplay, setWeatherDisplay] = useState<WeatherDisplayState>('idle')

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(intervalId)
  }, [])

  const companyName = company?.name?.trim() || null
  const companyLocation = formatCompanyDisplayLocation(company?.city, company?.country)
  const companyTimezone = timezone
  const weatherQueryLocation = resolveWeatherQueryLocation(
    company?.weatherLocation,
    company?.city,
    company?.country,
  )

  useEffect(() => {
    let cancelled = false
    let refreshIntervalId: number | undefined

    async function loadWeather(location: string, timeZone: string, attempt: number) {
      if (cancelled) return

      setWeatherDisplay('loading')

      try {
        const isNight = isNightHours(new Date(), timeZone)
        const snapshot = await getWeatherForLocation(location, { isNight })

        if (cancelled) return

        if (snapshot) {
          setWeather(displayWeatherSnapshot(snapshot, isNight))
          setWeatherDisplay('ready')
          return
        }

        if (attempt < WEATHER_RETRY_LIMIT) {
          await loadWeather(location, timeZone, attempt + 1)
          return
        }

        setWeather(null)
        setWeatherDisplay('unavailable')
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[useFleetOperationsHeader] weather request failed:', error)
        }

        if (cancelled) return

        if (attempt < WEATHER_RETRY_LIMIT) {
          await loadWeather(location, timeZone, attempt + 1)
          return
        }

        setWeather(null)
        setWeatherDisplay('unavailable')
      }
    }

    // Company settings are still loading — keep a loading state, never mark unavailable yet.
    if (isProfileLoading) {
      setWeatherDisplay((current) => (current === 'ready' ? current : 'loading'))
      return () => {
        cancelled = true
      }
    }

    if (!weatherQueryLocation) {
      setWeather(null)
      setWeatherDisplay('unavailable')
      return () => {
        cancelled = true
      }
    }

    void loadWeather(weatherQueryLocation, companyTimezone, 0)

    refreshIntervalId = window.setInterval(() => {
      void loadWeather(weatherQueryLocation, companyTimezone, 0)
    }, WEATHER_REFRESH_MS)

    return () => {
      cancelled = true
      if (refreshIntervalId !== undefined) {
        window.clearInterval(refreshIntervalId)
      }
    }
  }, [companyTimezone, isProfileLoading, weatherQueryLocation])

  const greeting = useMemo(() => getTimeGreeting(now), [now])
  const operationsDate = useMemo(
    () => formatCompanyOperationsDate(now, companyTimezone),
    [companyTimezone, now],
  )
  const localTime = useMemo(
    () => formatCompanyLocalTime(now, companyTimezone, timeFormat),
    [companyTimezone, now, timeFormat],
  )

  const displayedWeather = useMemo(() => {
    if (!weather) return null
    return displayWeatherSnapshot(weather, isNightHours(now, companyTimezone))
  }, [companyTimezone, now, weather])

  const backgroundMood = useMemo((): DashboardBackgroundMood => {
    return resolveDashboardBackgroundMood(displayedWeather, now, companyTimezone)
  }, [companyTimezone, displayedWeather, now])

  return {
    now,
    greeting,
    companyName,
    companyLocation,
    companyTimezone,
    localTime,
    operationsDate,
    weather: displayedWeather,
    weatherDisplay,
    backgroundMood,
    isProfileLoading,
  }
}
