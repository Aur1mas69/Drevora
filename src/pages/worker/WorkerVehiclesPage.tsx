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
  ClipboardCheck,
  CircleDot,
  FileWarning,
  Fuel,
  Loader2,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

const VEHICLES_RECONNECTING_MESSAGE = 'Reconnecting…'
const VEHICLES_LOAD_FALLBACK = 'Unable to load vehicles.'
const VEHICLES_RECONNECT_RETRY_MS = 2500
const VEHICLES_RECONNECT_MAX_ATTEMPTS = 4

type VehicleActionTone = 'violet' | 'amber' | 'rose'

const VEHICLE_ACTION_TONE: Record<
  VehicleActionTone,
  { card: string; iconWell: string; icon: string; hover: string; active: string }
> = {
  violet: {
    card: 'border-violet-200/80 bg-violet-50/90',
    iconWell: 'bg-violet-100 text-violet-700',
    icon: 'text-violet-700',
    hover: 'hover:border-violet-300 hover:bg-violet-100/90',
    active: 'active:border-violet-300 active:bg-violet-100',
  },
  amber: {
    card: 'border-amber-200/80 bg-amber-50/90',
    iconWell: 'bg-amber-100 text-amber-800',
    icon: 'text-amber-800',
    hover: 'hover:border-amber-300 hover:bg-amber-100/90',
    active: 'active:border-amber-300 active:bg-amber-100',
  },
  rose: {
    card: 'border-rose-200/80 bg-rose-50/90',
    iconWell: 'bg-rose-100 text-rose-700',
    icon: 'text-rose-700',
    hover: 'hover:border-rose-300 hover:bg-rose-100/90',
    active: 'active:border-rose-300 active:bg-rose-100',
  },
}

function VehicleActionCard({
  title,
  description,
  icon: Icon,
  to,
  disabled,
  comingSoon,
  tone,
  accentIndex = 0,
  isDark = false,
}: {
  title: string
  description: string
  icon: LucideIcon
  to?: string
  disabled?: boolean
  comingSoon?: boolean
  tone: VehicleActionTone
  accentIndex?: number
  isDark?: boolean
}) {
  const toneStyles = VEHICLE_ACTION_TONE[tone]
  const className = cn(
    'worker-list-card flex h-full min-h-[5.25rem] w-full flex-col justify-between text-left transition-colors',
    disabled
      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 shadow-none'
      : isDark
        ? workerAccentCardClass(accentIndex, true)
        : cn(toneStyles.card, 'shadow-slate-200/40', toneStyles.hover, toneStyles.active),
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex size-9 items-center justify-center rounded-xl',
            disabled
              ? 'bg-slate-100 text-slate-400'
              : isDark
                ? 'worker-accent-icon-well'
                : toneStyles.iconWell,
          )}
        >
          <Icon
            className={cn(
              'size-4',
              disabled ? 'text-slate-400' : !isDark && toneStyles.icon,
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Coming soon
          </span>
        ) : null}
      </div>
      <div>
        <p
          className={cn(
            'text-sm font-semibold leading-snug',
            disabled
              ? 'text-slate-400'
              : isDark
                ? 'worker-accent-title'
                : 'text-slate-950',
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            'mt-0.5 text-xs leading-snug',
            disabled
              ? 'text-slate-400'
              : isDark
                ? 'worker-accent-secondary'
                : 'text-slate-600',
          )}
        >
          {description}
        </p>
      </div>
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

function vehicleRegistrationLabel(vehicle: Vehicle): string {
  return vehicle.registration?.trim() || 'No registration'
}

export default function WorkerVehiclesPage() {
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
            : VEHICLES_LOAD_FALLBACK,
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
      setDefaultError('Select an active company vehicle first.')
      return
    }

    setIsSavingDefault(true)
    setDefaultError(null)
    setDefaultMessage(null)
    try {
      await setWorkerDefaultVehicle(selectedVehicle.id)
      reloadWorker()
      setDefaultMessage(
        `${vehicleRegistrationLabel(selectedVehicle)} saved as your default.`,
      )
    } catch (error) {
      setDefaultError(
        isRetryableNetworkError(error)
          ? 'Connection interrupted. Try again in a moment.'
          : error instanceof DriversServiceError
            ? error.message
            : error instanceof Error &&
                error.message.trim() &&
                !/^TypeError:/i.test(error.message)
              ? error.message
              : 'Unable to save your default vehicle.',
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
      setDefaultMessage('Default vehicle removed.')
    } catch (error) {
      setDefaultError(
        isRetryableNetworkError(error)
          ? 'Connection interrupted. Try again in a moment.'
          : error instanceof DriversServiceError
            ? error.message
            : error instanceof Error &&
                error.message.trim() &&
                !/^TypeError:/i.test(error.message)
              ? error.message
              : 'Unable to remove your default vehicle.',
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
        aria-label="Loading vehicles"
        role="status"
      />
    )
  }

  if (workerError || !worker) {
    return (
      <div className="rounded-[1.75rem] border border-rose-100 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-950">Vehicles</h1>
        <p className="mt-2 text-sm text-slate-600">
          {workerError ??
            'We could not find a worker profile linked to your account.'}
        </p>
      </div>
    )
  }

  const selectedRegistration = selectedVehicle
    ? vehicleRegistrationLabel(selectedVehicle)
    : ''
  const selectedMakeModel = selectedVehicle
    ? vehicleMakeModelLabel(selectedVehicle)
    : null
  const selectedType = selectedVehicle?.vehicleType?.trim() || null
  const selectedFleet = selectedVehicle?.fleetNumber?.trim()
    ? `Fleet ${selectedVehicle.fleetNumber.trim()}`
    : null

  return (
    <div className="mx-auto max-w-md space-y-5 lg:max-w-2xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Vehicles
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose an active company vehicle, then start a check or related action.
        </p>
      </header>

      {isReconnecting ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-800"
        >
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          {VEHICLES_RECONNECTING_MESSAGE}
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
        label="Search registration"
        placeholder="Enter registration number"
        inputAriaLabel="Search company vehicles by registration number"
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
                  Selected vehicle
                </p>
                {isSelectedDefault ? (
                  <span
                    className={cn(
                      'worker-accent-badge inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]',
                      !isDark && 'bg-emerald-200 text-emerald-900',
                    )}
                    role="status"
                  >
                    Default vehicle
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
              aria-label={`Remove selected vehicle ${selectedRegistration}`}
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
            {selectedType ? <p>Type: {selectedType}</p> : null}
            {selectedFleet ? <p>{selectedFleet}</p> : null}
          </div>

          {isSelectedDefault ? (
            <div className="mt-2.5">
              <button
                type="button"
                disabled={isSavingDefault}
                onClick={() => void handleRemoveDefault()}
                aria-label={`Remove ${selectedRegistration} as default vehicle`}
                className={cn(
                  'worker-accent-link inline-flex items-center gap-1.5 text-[13px] font-semibold underline-offset-2 transition-colors hover:underline disabled:opacity-60',
                  !isDark && 'text-[#0B477F] hover:text-[#083A66]',
                )}
              >
                {isSavingDefault ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                Remove default
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isSavingDefault}
              onClick={() => void handleSaveDefault()}
              aria-label={`Set ${selectedRegistration} as default vehicle`}
              className="mt-2.5 inline-flex h-8 items-center justify-center gap-2 rounded-xl bg-[#2F80ED] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#2563EB] disabled:opacity-60"
            >
              {isSavingDefault ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              Set as default
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
          Select a vehicle from the search results to continue. Typed registrations that
          are not in your company fleet cannot be used.
        </p>
      )}

      <div className="space-y-3">
        {selectedVehicle ? (
          <Link
            to={vehicleHref('/worker/vehicle-checks', selectedVehicleId)}
            className={cn(
              'worker-home-cta w-full text-white',
              isDark ? 'worker-cta-gradient' : 'worker-btn-primary',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <ClipboardCheck className="size-5 shrink-0 opacity-95" strokeWidth={1.75} aria-hidden />
                <span className="truncate">Start Vehicle Check</span>
              </span>
              <span className="pl-7 text-left text-xs font-normal text-white/85">
                Walkaround check for the selected vehicle.
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 opacity-90" aria-hidden />
          </Link>
        ) : (
          <div
            className={cn(
              'worker-home-cta w-full cursor-not-allowed text-white opacity-60',
              isDark ? 'worker-cta-gradient' : 'worker-btn-primary',
            )}
            aria-disabled="true"
          >
            <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
              <span className="flex min-w-0 items-center gap-2.5">
                <ClipboardCheck className="size-5 shrink-0 opacity-95" strokeWidth={1.75} aria-hidden />
                <span className="truncate">Start Vehicle Check</span>
              </span>
              <span className="pl-7 text-left text-xs font-normal text-white/85">
                Walkaround check for the selected vehicle.
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 opacity-90" aria-hidden />
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
          <VehicleActionCard
            title="Start Tyre Check"
            description="Tyre inspection workflow."
            icon={CircleDot}
            tone="violet"
            accentIndex={0}
            isDark={isDark}
            disabled={!selectedVehicle}
            to={vehicleHref('/worker/tyre-checks/new', selectedVehicleId)}
          />
          <VehicleActionCard
            title="Add Consumable"
            description="Record fuel, AdBlue or other consumables."
            icon={Fuel}
            tone="amber"
            accentIndex={1}
            isDark={isDark}
            disabled={!selectedVehicle}
            to={vehicleHref('/worker/consumables', selectedVehicleId)}
          />
          <VehicleActionCard
            title="Create Driver Report"
            description="Report a defect or operational issue."
            icon={FileWarning}
            tone="rose"
            accentIndex={2}
            isDark={isDark}
            disabled={!selectedVehicle}
            to={vehicleHref('/worker/driver-reports', selectedVehicleId)}
          />
        </section>
      </div>
    </div>
  )
}
