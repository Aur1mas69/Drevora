import { WorkerVehicleCombobox } from '@/components/worker/WorkerVehicleCombobox'
import { useAuth } from '@/contexts/AuthContext'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useIsWorkerDarkMode } from '@/hooks/useIsWorkerDarkMode'
import { isRetryableNetworkError } from '@/lib/networkError'
import {
  addOnlineStatusListener,
  getOnlineStatus,
} from '@/lib/networkStatus'
import { cn } from '@/lib/utils'
import { workerAccentCardClass } from '@/lib/workerDarkAccent'
import { readWorkerOfflineBootstrap } from '@/lib/workerOfflineBootstrap'
import {
  DriversServiceError,
  setWorkerDefaultVehicle,
} from '@/services/driversService'
import {
  fetchVehicles,
  type Vehicle,
} from '@/services/vehiclesService'
import {
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const VEHICLES_RECONNECT_RETRY_MS = 2500
const VEHICLES_RECONNECT_MAX_ATTEMPTS = 4

/** Same 68px well as Worker Home Quick Actions. */
const VEHICLE_QUICK_ACTION_ICON_CLASS = 'size-[68px] shrink-0 object-contain'

const SLICED_ICON = (file: string) =>
  `${import.meta.env.BASE_URL}icons/sliced/${file}?v=sliced`

function VehicleActionCard({
  title,
  description,
  iconSrc,
  to,
  disabled,
  accentIndex = 0,
  isDark = false,
  className: extraClassName,
}: {
  title: string
  description: string
  iconSrc: string
  to?: string
  disabled?: boolean
  accentIndex?: number
  isDark?: boolean
  className?: string
}) {
  const className = cn(
    'worker-home-quick-action h-full min-w-0 w-full text-left',
    disabled && 'worker-home-quick-action--disabled',
    !disabled &&
      isDark &&
      (accentIndex % 2 === 0
        ? 'worker-quick-action-mint'
        : 'worker-quick-action-indigo'),
    extraClassName,
  )

  const body = (
    <>
      <div className="worker-home-icon-well shrink-0">
        <img
          src={iconSrc}
          alt=""
          width={68}
          height={68}
          draggable={false}
          className={VEHICLE_QUICK_ACTION_ICON_CLASS}
        />
      </div>
      <div className="min-w-0 flex-1 pr-5">
        <p
          className={cn(
            'worker-home-qa-label text-[15px] font-semibold leading-snug break-words',
            !isDark && 'text-[color:var(--worker-text)]',
          )}
        >
          {title}
        </p>
        <p className="worker-home-qa-description mt-0.5 line-clamp-2 text-xs font-normal leading-snug break-words">
          {description}
        </p>
      </div>
      <ChevronRight className="worker-home-chevron shrink-0" aria-hidden />
    </>
  )

  if (disabled || !to) {
    return (
      <div className={className} aria-disabled="true">
        {body}
      </div>
    )
  }

  return (
    <Link to={to} className={className}>
      {body}
    </Link>
  )
}

function vehicleHref(path: string, vehicleId: string | null): string {
  if (!vehicleId) return path
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}vehicleId=${encodeURIComponent(vehicleId)}`
}

function vehicleMakeModelLabel(vehicle: Vehicle): string | null {
  const label = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim()
  return label || null
}

function vehicleRegistrationLabel(vehicle: Vehicle, fallback: string): string {
  return vehicle.registration?.trim() || fallback
}

export default function WorkerVehiclesPage() {
  const { t } = useTranslation('worker')
  const isDark = useIsWorkerDarkMode()
  const { session } = useAuth()
  const {
    worker,
    isLoading: workerLoading,
    error: workerError,
    reload: reloadWorker,
  } = useCurrentWorker()
  const {
    companyId,
    companyReady,
    companyLoading,
    membershipError,
  } = useCompanyTenantGate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isReconnecting, setIsReconnecting] = useState(false)
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [searchResetKey, setSearchResetKey] = useState(0)
  const [isSavingDefault, setIsSavingDefault] = useState(false)
  const [defaultMessage, setDefaultMessage] = useState<string | null>(null)
  const [defaultError, setDefaultError] = useState<string | null>(null)
  const [fleetReloadToken, setFleetReloadToken] = useState(0)
  const staleDefaultClearedRef = useRef(false)
  const vehiclesRef = useRef<Vehicle[]>([])

  useEffect(() => {
    vehiclesRef.current = vehicles
  }, [vehicles])

  useEffect(() => {
    let cancelled = false
    let removeListener: (() => Promise<void>) | null = null

    void addOnlineStatusListener((online) => {
      if (cancelled) return
      if (online) {
        setFleetReloadToken((token) => token + 1)
      }
    }).then((handle) => {
      if (cancelled) {
        void handle.remove()
        return
      }
      removeListener = () => handle.remove()
    })

    return () => {
      cancelled = true
      if (removeListener) void removeListener()
    }
  }, [])

  // While a transient reconnect is in progress, keep probing — online events can
  // fire before the network is actually usable for fetch.
  useEffect(() => {
    if (!isReconnecting) return
    const timer = window.setInterval(() => {
      void getOnlineStatus().then((online) => {
        if (online) setFleetReloadToken((token) => token + 1)
      })
    }, VEHICLES_RECONNECT_RETRY_MS * 2)
    return () => window.clearInterval(timer)
  }, [isReconnecting])

  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined

    async function restoreFromBootstrap(): Promise<Vehicle[] | null> {
      const userId = session?.user.id?.trim() || ''
      if (!userId) return null
      const cache = await readWorkerOfflineBootstrap(userId, companyId)
      if (!(cache && cache.vehicles.length > 0)) return null
      if (cancelled) return cache.vehicles
      setVehicles(cache.vehicles)
      vehiclesRef.current = cache.vehicles
      return cache.vehicles
    }

    function applyPreferredSelection(rows: Vehicle[]) {
      const savedDefaultId = worker?.defaultVehicleId?.trim() || null
      const savedDefaultIsValid =
        Boolean(savedDefaultId) &&
        rows.some((vehicle) => vehicle.id === savedDefaultId)

      setSelectedVehicleId((current) => {
        if (current && rows.some((vehicle) => vehicle.id === current)) return current
        return savedDefaultIsValid ? savedDefaultId : null
      })
    }

    async function fetchVehiclesWithTransientRetry(): Promise<Vehicle[]> {
      let lastError: unknown
      for (let attempt = 0; attempt < VEHICLES_RECONNECT_MAX_ATTEMPTS; attempt++) {
        try {
          return await fetchVehicles()
        } catch (error) {
          lastError = error
          if (!isRetryableNetworkError(error)) throw error
          if (cancelled) throw error
          if (!(await getOnlineStatus())) throw error
          if (attempt < VEHICLES_RECONNECT_MAX_ATTEMPTS - 1) {
            await new Promise<void>((resolve) => {
              retryTimer = window.setTimeout(
                resolve,
                VEHICLES_RECONNECT_RETRY_MS * (attempt + 1),
              )
            })
          }
        }
      }
      throw lastError
    }

    async function load() {
      if (companyLoading || workerLoading) return

      if (!companyReady || !worker) {
        if (vehiclesRef.current.length === 0) {
          setVehicles([])
        }
        setIsLoadingVehicles(false)
        setIsReconnecting(false)
        setLoadError(membershipError ?? workerError)
        return
      }

      const hadCachedFleet = vehiclesRef.current.length > 0
      // Keep existing/cached fleet visible during reconnect — never blank the page.
      if (!hadCachedFleet) {
        setIsLoadingVehicles(true)
      }
      setLoadError(null)

      const online = await getOnlineStatus()
      if (!online) {
        const restoredRows = hadCachedFleet
          ? vehiclesRef.current
          : await restoreFromBootstrap()
        if (cancelled) return
        if (restoredRows && restoredRows.length > 0) {
          applyPreferredSelection(restoredRows)
        }
        // Stably offline: keep cached fleet, never flash a raw fetch error.
        setIsReconnecting(false)
        setLoadError(null)
        setIsLoadingVehicles(false)
        return
      }

      setIsReconnecting(hadCachedFleet)

      try {
        const rows = await fetchVehiclesWithTransientRetry()
        if (cancelled) return
        setVehicles(rows)
        vehiclesRef.current = rows
        setIsReconnecting(false)
        setLoadError(null)

        const savedDefaultId = worker.defaultVehicleId?.trim() || null
        const savedDefaultIsValid =
          Boolean(savedDefaultId) &&
          rows.some((vehicle) => vehicle.id === savedDefaultId)

        // Stale default (archived/deleted/other company): clear the preference
        // once per load so Home no longer shows an invalid vehicle.
        if (savedDefaultId && !savedDefaultIsValid && !staleDefaultClearedRef.current) {
          staleDefaultClearedRef.current = true
          try {
            await setWorkerDefaultVehicle(null)
            if (!cancelled) reloadWorker()
          } catch {
            // Non-fatal: leave UI in search state without a fake default.
          }
        }

        applyPreferredSelection(rows)
      } catch (error) {
        if (cancelled) return

        if (isRetryableNetworkError(error)) {
          const restoredRows = hadCachedFleet
            ? vehiclesRef.current
            : await restoreFromBootstrap()
          if (cancelled) return
          if (restoredRows && restoredRows.length > 0) {
            applyPreferredSelection(restoredRows)
          }
          // Temporary reconnect flap — keep fleet, never show raw TypeError.
          setIsReconnecting(true)
          setLoadError(null)
          return
        }

        // Genuine non-network failure: only clear the list when we have nothing
        // cached to show, and never surface raw TypeError text.
        if (!hadCachedFleet && vehiclesRef.current.length === 0) {
          setVehicles([])
        }
        setIsReconnecting(false)
        setLoadError(
          error instanceof Error &&
            error.message.trim() &&
            !/^TypeError:/i.test(error.message)
            ? error.message
            : t('vehicles.loadFailed'),
        )
      } finally {
        if (!cancelled) setIsLoadingVehicles(false)
      }
    }

    void load()
    return () => {
      cancelled = true
      if (retryTimer != null) window.clearTimeout(retryTimer)
    }
  }, [
    companyId,
    companyLoading,
    companyReady,
    fleetReloadToken,
    membershipError,
    reloadWorker,
    session?.user.id,
    worker,
    workerError,
    workerLoading,
  ])

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null

  const isSelectedDefault =
    Boolean(selectedVehicle) &&
    selectedVehicle?.id === worker?.defaultVehicleId

  function clearSelection() {
    setSelectedVehicleId(null)
    setDefaultError(null)
    setDefaultMessage(null)
    setSearchResetKey((key) => key + 1)
    window.setTimeout(() => {
      document.getElementById('worker-vehicles-registration-search')?.focus()
    }, 0)
  }

  async function handleSaveDefault() {
    if (!selectedVehicle) {
      setDefaultError(t('vehicles.selectFirst'))
      return
    }

    setIsSavingDefault(true)
    setDefaultError(null)
    setDefaultMessage(null)
    try {
      await setWorkerDefaultVehicle(selectedVehicle.id)
      reloadWorker()
      setDefaultMessage(
        t('vehicles.savedDefault', {
          registration: vehicleRegistrationLabel(selectedVehicle, t('vehicles.noRegistration')),
        }),
      )
    } catch (error) {
      setDefaultError(
        isRetryableNetworkError(error)
          ? t('vehicles.connectionInterrupted')
          : error instanceof DriversServiceError
            ? error.message
            : error instanceof Error &&
                error.message.trim() &&
                !/^TypeError:/i.test(error.message)
              ? error.message
              : t('vehicles.saveDefaultFailed'),
      )
    } finally {
      setIsSavingDefault(false)
    }
  }

  async function handleRemoveDefault() {
    if (!selectedVehicle) return

    setIsSavingDefault(true)
    setDefaultError(null)
    setDefaultMessage(null)
    try {
      await setWorkerDefaultVehicle(null)
      reloadWorker()
      setDefaultMessage(t('vehicles.removedDefault'))
    } catch (error) {
      setDefaultError(
        isRetryableNetworkError(error)
          ? t('vehicles.connectionInterrupted')
          : error instanceof DriversServiceError
            ? error.message
            : error instanceof Error &&
                error.message.trim() &&
                !/^TypeError:/i.test(error.message)
              ? error.message
              : t('vehicles.removeDefaultFailed'),
      )
    } finally {
      setIsSavingDefault(false)
    }
  }

  // Keep cached fleet on screen while a reconnect fetch runs — never flash a blank page.
  if (
    (workerLoading || companyLoading || isLoadingVehicles) &&
    vehicles.length === 0 &&
    !isReconnecting
  ) {
    return (
      <div
        className="min-h-[40vh] rounded-[1.75rem] bg-white/60"
        aria-label={t('vehicles.loading')}
        role="status"
      />
    )
  }

  if (workerError || !worker) {
    return (
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">{t('vehicles.title')}</h1>
        <p className="mt-2 text-sm text-slate-600">
          {workerError ?? t('vehicles.profileMissing')}
        </p>
      </div>
    )
  }

  const selectedRegistration = selectedVehicle
    ? vehicleRegistrationLabel(selectedVehicle, t('vehicles.noRegistration'))
    : ''
  const selectedMakeModel = selectedVehicle
    ? vehicleMakeModelLabel(selectedVehicle)
    : null
  const selectedType = selectedVehicle?.vehicleType?.trim() || null
  const selectedFleet = selectedVehicle?.fleetNumber?.trim()
    ? t('vehicles.fleetLabel', { number: selectedVehicle.fleetNumber.trim() })
    : null

  return (
    <div className="mx-auto max-w-md space-y-5 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          {t('vehicles.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {t('vehicles.subtitle')}
        </p>
      </header>

      {isReconnecting ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          {t('vehicles.reconnecting')}
        </p>
      ) : null}

      {loadError ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </p>
      ) : null}

      <WorkerVehicleCombobox
        key={searchResetKey}
        id="worker-vehicles-registration-search"
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelect={(vehicle) => {
          setSelectedVehicleId(vehicle.id)
          setDefaultError(null)
          setDefaultMessage(null)
        }}
        onClear={clearSelection}
        label={t('vehicles.searchLabel')}
        placeholder={t('vehicles.searchPlaceholder')}
        inputAriaLabel={t('vehicles.searchAria')}
        showAllWhenEmpty
        showSelectedSummary={false}
      />

      {selectedVehicle ? (
        <section
          className={cn(
            workerAccentCardClass(
              0,
              isDark,
              'rounded-[1.35rem] border p-3.5 shadow-[0_1px_3px_rgba(33,142,231,0.12)]',
            ),
            !isDark && 'border-[#89CFF0]',
          )}
          style={
            isDark
              ? undefined
              : {
                  backgroundImage:
                    'linear-gradient(135deg, #9FD0F0 0%, #BFE3F5 35%, #E8F3FE 68%, #FFFFFF 100%)',
                }
          }
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p
                  className={cn(
                    'worker-accent-muted text-[10px] font-semibold uppercase tracking-[0.14em]',
                    !isDark && 'text-[#0B68BE]',
                  )}
                >
                  {t('vehicles.selectedVehicle')}
                </p>
                {isSelectedDefault ? (
                  <span
                    className={cn(
                      'worker-accent-badge inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]',
                      !isDark && 'bg-emerald-200 text-emerald-900',
                    )}
                    role="status"
                  >
                    {t('vehicles.defaultVehicle')}
                  </span>
                ) : null}
              </div>
              <p
                className={cn(
                  'worker-accent-title mt-1 truncate text-lg font-bold tracking-tight sm:text-xl',
                  !isDark && 'text-[#0B1F3A]',
                )}
              >
                {selectedRegistration}
              </p>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              aria-label={t('vehicles.removeSelectedAria', { registration: selectedRegistration })}
              className={cn(
                'worker-accent-icon-well flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                !isDark &&
                  'border-[#89CFF0] bg-white/80 text-slate-700 hover:bg-white hover:text-slate-950',
              )}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          <div
            className={cn(
              'worker-accent-secondary mt-1.5 space-y-0.5 text-[13px] font-medium leading-snug',
              !isDark && 'text-[#1B4F8A]',
            )}
          >
            {selectedMakeModel ? <p>{selectedMakeModel}</p> : null}
            {selectedType ? <p>{t('vehicles.typeLabel', { type: selectedType })}</p> : null}
            {selectedFleet ? <p>{selectedFleet}</p> : null}
          </div>

          {isSelectedDefault ? (
            <div className="mt-2.5">
              <button
                type="button"
                disabled={isSavingDefault}
                onClick={() => void handleRemoveDefault()}
                aria-label={t('vehicles.removeDefaultAria', { registration: selectedRegistration })}
                className={cn(
                  'worker-accent-link inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-2 transition-colors hover:underline disabled:opacity-60',
                  !isDark && 'text-[#0B477F] hover:text-[#083A66]',
                )}
              >
                {isSavingDefault ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                {t('vehicles.removeDefault')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isSavingDefault}
              onClick={() => void handleSaveDefault()}
              aria-label={t('vehicles.setDefaultAria', { registration: selectedRegistration })}
              className="mt-2.5 inline-flex h-8 items-center justify-center gap-2 rounded-xl bg-[#2F80ED] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-60"
            >
              {isSavingDefault ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {t('vehicles.setDefault')}
            </button>
          )}

          {defaultMessage ? (
            <p
              className={cn(
                'worker-accent-value mt-1.5 text-[13px] font-semibold',
                !isDark && 'text-emerald-800',
              )}
            >
              {defaultMessage}
            </p>
          ) : null}
          {defaultError ? (
            <p className="mt-1.5 text-[13px] font-semibold text-rose-700">{defaultError}</p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          {t('vehicles.emptyHint')}
        </p>
      )}

      <div className="space-y-3 overflow-visible">
        {selectedVehicle ? (
          <Link
            to={vehicleHref('/worker/vehicle-checks', selectedVehicleId)}
            className={cn(
              'worker-home-cta w-full !items-stretch overflow-hidden py-0 text-white',
              isDark ? 'worker-cta-gradient' : 'worker-btn-primary',
            )}
          >
            <span className="-ml-4 flex w-[5.25rem] shrink-0 self-stretch" aria-hidden>
              <img
                src={SLICED_ICON('vehicle-checks.png')}
                alt=""
                width={76}
                height={76}
                draggable={false}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 py-2.5">
              <span className="truncate">{t('vehicles.startVehicleCheck')}</span>
              <span className="text-left text-xs font-normal text-white/85">
                {t('vehicles.startVehicleCheckHint')}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 self-center opacity-90" aria-hidden />
          </Link>
        ) : (
          <div
            className={cn(
              'worker-home-cta w-full cursor-not-allowed !items-stretch overflow-hidden py-0 text-white opacity-60',
              isDark ? 'worker-cta-gradient' : 'worker-btn-primary',
            )}
            aria-disabled="true"
          >
            <span className="-ml-4 flex w-[5.25rem] shrink-0 self-stretch" aria-hidden>
              <img
                src={SLICED_ICON('vehicle-checks.png')}
                alt=""
                width={76}
                height={76}
                draggable={false}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5 py-2.5">
              <span className="truncate">{t('vehicles.startVehicleCheck')}</span>
              <span className="text-left text-xs font-normal text-white/85">
                {t('vehicles.startVehicleCheckHint')}
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 self-center opacity-90" aria-hidden />
          </div>
        )}

        <section className="worker-home-quick-actions-grid grid grid-cols-2 gap-3 overflow-visible">
          <VehicleActionCard
            title={t('vehicles.startTyreCheck')}
            description={t('vehicles.startTyreCheckHint')}
            iconSrc={SLICED_ICON('tyre-checks.png')}
            accentIndex={0}
            isDark={isDark}
            disabled={!selectedVehicle}
            to={vehicleHref('/worker/tyre-checks/new', selectedVehicleId)}
          />
          <VehicleActionCard
            title={t('vehicles.addConsumable')}
            description={t('vehicles.addConsumableHint')}
            iconSrc={SLICED_ICON('consumables.png')}
            accentIndex={1}
            isDark={isDark}
            disabled={!selectedVehicle}
            to={vehicleHref('/worker/consumables', selectedVehicleId)}
          />
          <VehicleActionCard
            title={t('vehicles.createDriverReport')}
            description={t('vehicles.createDriverReportHint')}
            iconSrc={SLICED_ICON('driver-reports.png')}
            accentIndex={2}
            isDark={isDark}
            disabled={!selectedVehicle}
            to={vehicleHref('/worker/driver-reports', selectedVehicleId)}
            className="col-span-2"
          />
        </section>
      </div>
    </div>
  )
}
