import { WeatherHeroBackground } from '@/components/dashboard/WeatherHeroBackground'
import type { FleetOperationsHeaderState } from '@/hooks/useFleetOperationsHeader'
import { hasCompanyDisplayName } from '@/lib/company'
import { isNightHours } from '@/services/weatherService'
import { useMemo } from 'react'

const HERO_TEXT_SHADOW = '0 1px 2px rgba(255, 255, 255, 0.45)'

const WEATHER_CARD_STYLE = {
  background: 'rgba(21, 34, 21, 0.5)',
  borderColor: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  boxShadow: '0 12px 32px rgba(10,30,70,0.16)',
  color: 'rgba(2, 6, 24, 0.99)',
} as const

type FleetOperationsInfoPanelProps = Pick<
  FleetOperationsHeaderState,
  'companyLocation' | 'localTime' | 'operationsDate' | 'weather' | 'weatherDisplay' | 'isProfileLoading'
>

function LocationPinIcon() {
  return (
    <svg
      viewBox="0 0 12 12"
      className="mr-1.5 inline-block size-3 shrink-0 text-[#D5C834]"
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
        className="relative z-10 w-full min-w-0 max-w-[200px] shrink-0 animate-pulse rounded-[14px] border border-white/5 p-3 fleet-weather-card sm:max-w-[220px] sm:p-3.5"
        style={WEATHER_CARD_STYLE}
        aria-hidden="true"
      >
        <div className="space-y-2">
          <div className="h-3 w-28 rounded-full bg-[#020618]/15" />
          <div className="h-3.5 w-32 rounded-full bg-[#020618]/15" />
          <div className="h-7 w-16 rounded-lg bg-[#020618]/10" />
          <div className="h-2.5 w-28 rounded-full bg-[#020618]/10" />
        </div>
      </div>
    )
  }

  return (
    <aside
      className="fleet-weather-card relative z-10 w-full min-w-0 max-w-[200px] shrink-0 overflow-hidden rounded-[14px] border border-white/5 p-3 sm:max-w-[220px] sm:p-3.5"
      style={WEATHER_CARD_STYLE}
      aria-label="Fleet location, weather and time"
    >
      <div className="relative space-y-2">
        <p className="truncate text-[11px] font-medium leading-4 text-[#D5C834]">
          <LocationPinIcon />
          {companyLocation ?? (
            <span className="text-[#D5C834]/70">Company location not configured</span>
          )}
        </p>

        {weatherDisplay === 'loading' || weatherDisplay === 'idle' ? (
          <p className="text-[11px] font-medium text-white/70">Loading weather…</p>
        ) : weatherDisplay === 'ready' && weather ? (
          <div className="flex items-center gap-1.5">
            <span aria-hidden="true" className="text-sm leading-none">
              {weather.icon}
            </span>
            <p className="min-w-0 truncate text-[11px] font-medium text-white/90">
              {weather.conditionLabel}
              <span className="mx-1 text-white/40">•</span>
              <span className="text-base font-semibold tabular-nums tracking-[-0.03em] text-white">
                {weather.temperatureC}°C
              </span>
            </p>
          </div>
        ) : (
          <p className="text-[11px] font-medium text-white/75">Weather unavailable</p>
        )}

        <div className="border-t border-white/10 pt-2">
          <p className="text-[1.35rem] font-semibold leading-none tracking-[-0.05em] tabular-nums text-white sm:text-[1.45rem]">
            {localTime}
          </p>
          <p className="mt-1 text-[10px] font-medium leading-4 text-[rgba(242,230,99,0.8)]">
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
    <header className="relative h-[190px] overflow-hidden rounded-[20px] border border-white/40 shadow-[0_4px_28px_rgba(40,80,140,0.08)] sm:h-[210px] sm:rounded-[24px] lg:h-[230px]">
      <WeatherHeroBackground
        weatherCondition={weather?.condition ?? null}
        isNight={isNight}
      />

      <div className="relative z-10 flex h-full items-center px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
        <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:gap-5">
          <div className="min-w-0 max-w-[min(100%,28rem)] p-5 sm:p-6">
            {isProfileLoading ? (
              <div className="space-y-2">
                <div className="h-4 w-32 animate-pulse rounded-full bg-[#0E3267]/20" />
                <div className="h-8 w-48 max-w-full animate-pulse rounded-xl bg-[#0E3267]/15" />
                <div className="h-3 w-40 animate-pulse rounded-full bg-[#1E3967]/20" />
                <div className="h-3 w-28 animate-pulse rounded-full bg-[#475562]/15" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <p
                  className="text-[18px] font-medium tracking-[-0.02em] text-[#0E3267]"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  {greeting}
                </p>

                {hasCompany ? (
                  <h1
                    className="text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0E3267] [overflow-wrap:anywhere] [word-break:break-word] sm:text-[30px] lg:text-[36px]"
                    style={{ textShadow: HERO_TEXT_SHADOW }}
                  >
                    {companyName}
                  </h1>
                ) : (
                  <h1
                    className="text-[26px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0E3267]/70 [overflow-wrap:anywhere] [word-break:break-word] sm:text-[30px] lg:text-[36px]"
                    style={{ textShadow: HERO_TEXT_SHADOW }}
                  >
                    Company profile incomplete
                  </h1>
                )}

                <p
                  className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#1E3967] sm:text-[11px] sm:tracking-[0.2em]"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  Fleet Operations Centre
                </p>

                <p
                  className="text-xs font-medium tracking-[-0.01em] text-[#0E3267] sm:text-sm"
                  style={{ textShadow: HERO_TEXT_SHADOW }}
                >
                  Live Fleet Dashboard
                </p>
              </div>
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
