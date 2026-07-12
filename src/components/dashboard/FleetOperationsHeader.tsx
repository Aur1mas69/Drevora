import { WeatherHeroBackground } from '@/components/dashboard/WeatherHeroBackground'
import type { FleetOperationsHeaderState } from '@/hooks/useFleetOperationsHeader'
import { hasCompanyDisplayName } from '@/lib/company'
import { isNightHours } from '@/services/weatherService'
import { useMemo } from 'react'

/** Soft left-edge wash — starts at x=0 of the hero; fades into the image. */
const HERO_TEXT_READABILITY_GRADIENT =
  'linear-gradient(90deg, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0.82) 18%, rgba(255,255,255,0.68) 38%, rgba(255,255,255,0.38) 56%, rgba(255,255,255,0.00) 100%)'

const WEATHER_CARD_STYLE = {
  background: 'rgba(21, 34, 21, 0.5)',
  borderColor: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'none',
  WebkitBackdropFilter: 'none',
  boxShadow: '0 12px 32px rgba(10,30,70,0.16)',
  color: 'rgba(2, 6, 24, 0.99)',
} as const

type FleetOperationsInfoCardProps = Pick<
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

function FleetOperationsInfoCard({
  companyLocation,
  localTime,
  operationsDate,
  weather,
  weatherDisplay,
  isProfileLoading,
}: FleetOperationsInfoCardProps) {
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

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[50%] sm:w-[48%] lg:w-[46%]"
        style={{ background: HERO_TEXT_READABILITY_GRADIENT }}
      />

      <div className="relative z-10 flex h-full items-center px-4 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-7">
        <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:gap-5">
          <div className="min-w-0 max-w-[min(52%,20rem)] sm:max-w-[min(48%,26rem)] lg:max-w-[min(44%,32rem)]">
            {isProfileLoading ? (
              <div className="space-y-1.5">
                <div className="h-4 w-32 animate-pulse rounded-full bg-[#1E3A5F]/20" />
                <div className="h-8 w-48 max-w-full animate-pulse rounded-xl bg-[#0F2F5F]/15" />
                <div className="h-3 w-40 animate-pulse rounded-full bg-[#2563EB]/20" />
                <div className="h-3 w-28 animate-pulse rounded-full bg-[#334E68]/15" />
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[16px] font-semibold tracking-[-0.02em] text-[#1E3A5F] sm:text-[17px] lg:text-[18px]">
                  {greeting}
                </p>

                {hasCompany ? (
                  <h1 className="text-[28px] font-bold leading-[1.12] tracking-[-0.02em] text-[#0F2F5F] [overflow-wrap:anywhere] [word-break:break-word] sm:text-[34px] lg:text-[36px]">
                    {companyName}
                  </h1>
                ) : (
                  <h1 className="text-[28px] font-bold leading-[1.12] tracking-[-0.02em] text-[#0F2F5F]/70 [overflow-wrap:anywhere] [word-break:break-word] sm:text-[34px] lg:text-[36px]">
                    Company profile incomplete
                  </h1>
                )}

                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2563EB] sm:text-[12px] sm:tracking-[0.2em]">
                  Fleet Operations Centre
                </p>

                <p className="text-[13px] font-medium tracking-[-0.01em] text-[#334E68] sm:text-[14px]">
                  Live Fleet Dashboard
                </p>
              </div>
            )}
          </div>

          <FleetOperationsInfoCard
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
