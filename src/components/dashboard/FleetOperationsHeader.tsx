import { WeatherHeroBackground } from '@/components/dashboard/WeatherHeroBackground'
import type { FleetOperationsHeaderState } from '@/hooks/useFleetOperationsHeader'
import { hasCompanyDisplayName } from '@/lib/company'
import { MapPin } from 'lucide-react'

type FleetOperationsInfoCardProps = Pick<
  FleetOperationsHeaderState,
  'companyLocation' | 'localTime' | 'operationsDate' | 'weather' | 'weatherDisplay' | 'isProfileLoading'
>

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
        className="relative z-10 w-full min-w-0 shrink-0 animate-pulse md:w-[300px] md:max-w-[300px] lg:w-[310px] lg:max-w-[310px]"
        aria-hidden="true"
      >
        <div
          className="pointer-events-none absolute top-1/2 left-0 hidden h-[145px] w-px -translate-y-1/2 bg-white/30 md:block"
          aria-hidden="true"
        />
        <div className="space-y-3 rounded-xl bg-[rgba(8,20,48,0.14)] px-2.5 py-2.5 backdrop-blur-sm md:pl-7 md:pr-2">
          <div className="h-3.5 w-40 rounded-full bg-white/20" />
          <div className="flex items-center justify-between gap-6">
            <div className="h-3.5 w-28 rounded-full bg-white/20" />
            <div className="h-5 w-12 rounded-lg bg-white/15" />
          </div>
          <div className="h-px w-full bg-white/20" />
          <div className="h-8 w-28 rounded-lg bg-white/15" />
          <div className="h-3 w-44 rounded-full bg-white/15" />
        </div>
      </div>
    )
  }

  return (
    <aside
      className="relative z-10 w-full min-w-0 shrink-0 md:w-[300px] md:max-w-[300px] lg:w-[310px] lg:max-w-[310px]"
      aria-label="Fleet location, weather and time"
    >
      {/* Desktop vertical divider — ~145px, ~80–90% of panel height */}
      <div
        className="pointer-events-none absolute top-1/2 left-0 hidden h-[145px] w-px -translate-y-1/2 bg-white/30 md:block"
        aria-hidden="true"
      />

      <div className="rounded-xl bg-[rgba(8,20,48,0.14)] px-2.5 py-2.5 backdrop-blur-sm md:pl-7 md:pr-2">
        <div className="flex items-center gap-1.5">
          <MapPin
            className="size-4 shrink-0 text-white/90 sm:size-[1.05rem]"
            aria-hidden="true"
            strokeWidth={2.4}
          />
          <p className="min-w-0 truncate text-[13px] font-bold uppercase tracking-[0.12em] text-white sm:text-[14px] lg:text-[15px]">
            {companyLocation ?? (
              <span className="normal-case tracking-normal text-white/65">
                Company location not configured
              </span>
            )}
          </p>
        </div>

        <div className="mt-3 flex min-h-[1.5rem] items-center justify-between gap-6 sm:mt-3.5 sm:gap-8">
          {weatherDisplay === 'loading' || weatherDisplay === 'idle' ? (
            <p className="text-[13px] font-medium text-white/70">Loading weather…</p>
          ) : weatherDisplay === 'ready' && weather ? (
            <>
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center text-[1.45rem] leading-none sm:size-8 sm:text-[1.65rem] [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.35))]"
                >
                  {weather.icon}
                </span>
                <p className="min-w-0 truncate text-[13px] font-medium text-white/90 sm:text-[14px]">
                  {weather.conditionLabel}
                </p>
              </div>
              <p className="shrink-0 pl-2 text-[1.15rem] font-bold tabular-nums tracking-[-0.03em] text-white sm:text-[1.25rem]">
                {weather.temperatureC}°C
              </p>
            </>
          ) : (
            <p className="text-[13px] font-medium text-white/75">Weather unavailable</p>
          )}
        </div>

        <div className="mt-3.5 h-px w-full bg-white/25 sm:mt-4" aria-hidden="true" />

        <div className="mt-3.5 sm:mt-4">
          <p className="text-[1.65rem] font-semibold leading-none tracking-[-0.05em] tabular-nums text-white sm:text-[1.85rem] md:text-[2.05rem]">
            {localTime}
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-4 text-white/65 sm:text-[12px]">
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
  localTime,
  operationsDate,
  weather,
  weatherDisplay,
  isProfileLoading,
}: FleetOperationsHeaderProps) {
  const hasCompany = hasCompanyDisplayName(companyName)

  return (
    <header className="relative min-h-[190px] overflow-hidden rounded-[20px] border border-white/40 shadow-[0_4px_28px_rgba(40,80,140,0.08)] sm:rounded-[24px] md:h-[210px] md:min-h-0 lg:h-[230px]">
      <WeatherHeroBackground />

      <div
        aria-hidden="true"
        className="admin-dashboard-hero-left-wash pointer-events-none absolute inset-y-0 left-0 z-[1] w-[50%] sm:w-[48%] lg:w-[46%]"
      />

      {/* Left ~36px desktop; right ~8px — weather panel stays at the far right */}
      <div className="relative z-10 flex h-full items-stretch py-4 pl-4 pr-2 sm:py-5 sm:pl-5 sm:pr-2 md:items-center lg:py-7 lg:pl-9 lg:pr-2">
        <div className="flex w-full min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="min-w-0 md:max-w-[min(50%,22rem)] lg:max-w-[min(48%,34rem)]">
            {isProfileLoading ? (
              <div className="flex flex-col">
                <div className="mb-2 h-4 w-36 animate-pulse rounded-full bg-[#1E3A5F]/20 lg:mb-2.5" />
                <div className="mb-1.5 h-9 w-56 max-w-full animate-pulse rounded-xl bg-[#0F2F5F]/15 sm:mb-2 sm:h-10" />
                <div className="mb-1.5 h-3 w-44 animate-pulse rounded-full bg-[#2563EB]/20 sm:mb-2" />
                <div className="h-3.5 w-32 animate-pulse rounded-full bg-[#334E68]/15" />
              </div>
            ) : (
              <div className="flex flex-col items-start">
                <p className="mb-2 text-[16px] font-semibold leading-snug tracking-[-0.01em] text-[#1E3A5F] sm:text-[17px] lg:mb-2.5 lg:text-[18px]">
                  {greeting}
                </p>

                {hasCompany ? (
                  <h1 className="mb-1.5 text-[24px] font-bold leading-[1.08] tracking-[-0.02em] text-[#0F2F5F] [overflow-wrap:anywhere] [word-break:break-word] sm:mb-2 sm:text-[28px] lg:text-[36px]">
                    {companyName}
                  </h1>
                ) : (
                  <h1 className="mb-1.5 text-[24px] font-bold leading-[1.08] tracking-[-0.02em] text-[#0F2F5F]/70 [overflow-wrap:anywhere] [word-break:break-word] sm:mb-2 sm:text-[28px] lg:text-[36px]">
                    Company profile incomplete
                  </h1>
                )}

                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#2563EB] sm:mb-2 sm:text-[13px] lg:text-[14px] lg:tracking-[0.2em]">
                  Fleet Operations Centre
                </p>

                <p className="text-[14px] font-medium leading-snug tracking-[-0.01em] text-[#334E68] sm:text-[15px] lg:text-[16px]">
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
