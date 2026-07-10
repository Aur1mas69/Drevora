import { WeatherHeroBackground } from '@/components/dashboard/WeatherHeroBackground'
import type { FleetOperationsHeaderState } from '@/hooks/useFleetOperationsHeader'
import { hasCompanyDisplayName } from '@/lib/company'
import { isNightHours } from '@/services/weatherService'
import { useMemo } from 'react'

const HERO_TEXT_SHADOW = '0 2px 12px rgba(255,255,255,0.35)'

const WEATHER_CARD_STYLE = {
  background: 'rgba(15, 35, 75, 0.28)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  boxShadow: '0 20px 50px rgba(10,30,70,0.18)',
} as const

type FleetOperationsInfoPanelProps = Pick<
  FleetOperationsHeaderState,
  'companyLocation' | 'localTime' | 'operationsDate' | 'weather' | 'weatherDisplay' | 'isProfileLoading'
>

function LocationPinIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="mr-1.5 inline-block size-3 shrink-0 text-blue-200/90"
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.625 3.5 6.5 3.5 6.5s3.5-3.875 3.5-6.5C9.5 2.567 7.933 1 6 1Z"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="6" cy="4.5" r="1.25" fill="currentColor" />
    </svg>
  )
}

function FleetOperationsInfoPanel({
  companyLocation,
  localTime,
  operationsDate,
  weather,
  weatherDisplay,
  isProfileLoading,
}: FleetOperationsInfoPanelProps) {
  if (isProfileLoading) {
    return (
      <div
        className="relative z-10 w-full min-w-0 max-w-none shrink-0 animate-pulse rounded-[18px] border border-white/35 p-3.5 fleet-weather-card sm:max-w-[272px] sm:min-w-[238px] sm:p-4"
        style={WEATHER_CARD_STYLE}
        aria-hidden="true"
      >
        <div className="space-y-2.5">
          <div className="h-3.5 w-32 rounded-full bg-white/20" />
          <div className="h-4 w-36 rounded-full bg-white/20" />
          <div className="h-8 w-20 rounded-lg bg-white/20" />
          <div className="h-3 w-32 rounded-full bg-white/15" />
        </div>
      </div>
    )
  }

  return (
    <aside
      className="fleet-weather-card relative z-10 w-full min-w-0 max-w-none shrink-0 overflow-hidden rounded-[18px] border border-white/35 p-3.5 sm:max-w-[272px] sm:min-w-[238px] sm:p-[1.125rem]"
      style={WEATHER_CARD_STYLE}
      aria-label="Fleet location, weather and time"
    >
      <div className="relative space-y-3">
        <p className="text-xs font-medium leading-4 text-blue-100/90">
          <LocationPinIcon />
          {companyLocation ?? (
            <span className="text-blue-200/75">Company location not configured</span>
          )}
        </p>

        {weatherDisplay === 'loading' ? (
          <p className="text-xs font-medium text-blue-200/70">Loading weather…</p>
        ) : weatherDisplay === 'ready' && weather ? (
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="text-sm leading-none">
              {weather.icon}
            </span>
            <p className="min-w-0 text-xs font-medium text-blue-50/90">
              {weather.conditionLabel}
              <span className="mx-1 text-blue-200/40">•</span>
              <span className="text-[1.15rem] font-semibold tabular-nums tracking-[-0.03em] text-white">
                {weather.temperatureC}°C
              </span>
            </p>
          </div>
        ) : (
          <p className="text-xs font-medium text-blue-200/75">Weather unavailable</p>
        )}

        <div className="border-t border-white/20 pt-3">
          <p className="text-[1.7rem] font-semibold leading-none tracking-[-0.05em] tabular-nums text-white sm:text-[1.825rem]">
            {localTime}
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-4 text-blue-100/80">
            {operationsDate}
          </p>
        </div>
      </div>
    </aside>
  )
}

type FleetOperationsHeaderProps = FleetOperationsHeaderState

export function FleetOperationsHeader({
  greeting,
  companyName,
  companyLocation,
  companyTimezone,
  now,
  localTime,
  operationsDate,
  weather,
  weatherDisplay,
  isProfileLoading,
}: FleetOperationsHeaderProps) {
  const hasCompany = hasCompanyDisplayName(companyName)

  const isNight = useMemo(
    () => isNightHours(now, companyTimezone),
    [companyTimezone, now],
  )

  return (
    <header className="relative min-h-[168px] overflow-hidden rounded-[20px] border border-white/40 shadow-[0_4px_28px_rgba(40,80,140,0.08)] sm:min-h-[240px] sm:rounded-[24px] lg:min-h-[300px]">
      <WeatherHeroBackground
        weatherCondition={weather?.condition ?? null}
        isNight={isNight}
      />

      <div className="relative z-10 flex min-h-[168px] flex-col justify-center px-4 py-5 sm:min-h-[240px] sm:px-9 sm:py-9 lg:min-h-[300px] lg:px-10 lg:py-10">
        <div className="flex flex-col gap-4 sm:gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0 flex-1 space-y-2 sm:space-y-3.5">
            {isProfileLoading ? (
              <div className="space-y-3">
                <div className="h-5 w-36 animate-pulse rounded-full bg-white/30" />
                <div className="h-14 w-full max-w-xl animate-pulse rounded-2xl bg-white/25" />
                <div className="h-3.5 w-44 animate-pulse rounded-full bg-white/20" />
                <div className="h-4 w-36 animate-pulse rounded-full bg-white/20" />
              </div>
            ) : (
              <>
                <p
                  className="text-base font-medium tracking-[-0.02em] text-[#10275f]/85 sm:text-lg lg:text-xl"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  {greeting}
                </p>

                {hasCompany ? (
                  <h1
                    className="text-[1.85rem] font-bold leading-[1.08] tracking-[-0.04em] text-[#10275f] sm:text-[2.5rem] sm:leading-[1.05] lg:text-[3.25rem]"
                    style={{ textShadow: HERO_TEXT_SHADOW }}
                  >
                    {companyName}
                  </h1>
                ) : (
                  <h1
                    className="text-[1.85rem] font-bold leading-[1.08] tracking-[-0.03em] text-[#10275f]/65 sm:text-[2.5rem] sm:leading-[1.05] lg:text-[3.25rem]"
                    style={{ textShadow: HERO_TEXT_SHADOW }}
                  >
                    Company profile incomplete
                  </h1>
                )}

                <p
                  className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2563EB] sm:text-[11px] sm:tracking-[0.2em]"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  Fleet Operations Centre
                </p>

                <p
                  className="text-xs font-medium tracking-[-0.01em] text-[#10275f]/70 sm:text-sm"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  Live Fleet Dashboard
                </p>
              </>
            )}
          </div>

          <FleetOperationsInfoPanel
            companyLocation={companyLocation}
            localTime={localTime}
            operationsDate={operationsDate}
            weather={weather}
            weatherDisplay={weatherDisplay}
            isProfileLoading={isProfileLoading}
          />
        </div>
      </div>
    </header>
  )
}
