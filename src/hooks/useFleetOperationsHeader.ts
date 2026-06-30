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
import { useCallback, useEffect, useMemo, useState } from 'react'

const WEATHER_REFRESH_MS = 30 * 60 * 1000

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
  const weatherLocation = company?.weatherLocation?.trim() || null

  const loadWeather = useCallback(
    async (location: string, timeZone: string) => {
      setWeatherDisplay('loading')

      try {
        const isNight = isNightHours(new Date(), timeZone)
        const snapshot = await getWeatherForLocation(location, { isNight })

        if (snapshot) {
          setWeather(displayWeatherSnapshot(snapshot, isNight))
          setWeatherDisplay('ready')
        } else {
          setWeather(null)
          setWeatherDisplay('unavailable')
        }
      } catch {
        setWeather(null)
        setWeatherDisplay('unavailable')
      }
    },
    [],
  )

  useEffect(() => {
    if (!weatherLocation) {
      setWeather(null)
      setWeatherDisplay('unavailable')
      return
    }

    void loadWeather(weatherLocation, companyTimezone)

    const intervalId = window.setInterval(() => {
      void loadWeather(weatherLocation, companyTimezone)
    }, WEATHER_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [companyTimezone, loadWeather, weatherLocation])

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
