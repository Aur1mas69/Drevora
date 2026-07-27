import { WorkerVehicleCombobox } from '@/components/worker/WorkerVehicleCombobox'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { cn } from '@/lib/utils'
import {
  DriversServiceError,
  setWorkerDefaultVehicle,
} from '@/services/driversService'
import {
  fetchVehicles,
  type Vehicle,
} from '@/services/vehiclesService'
import {
  ClipboardCheck,
  CircleDot,
  FileWarning,
  Fuel,
  Loader2,
  Truck,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

function VehicleActionCard({
  title,
  description,
  icon: Icon,
  to,
  disabled,
  comingSoon,
  activeClassName,
}: {
  title: string
  description: string
  icon: typeof Truck
  to?: string
  disabled?: boolean
  comingSoon?: boolean
  activeClassName?: string
}) {
  const className = cn(
    'flex min-h-[5.5rem] w-full flex-col justify-between rounded-[1.5rem] border p-4 text-left shadow-sm transition-colors',
    disabled
      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
      : 'border-slate-100 bg-white text-slate-950 shadow-slate-200/60 hover:border-[#BFDFFF] hover:bg-[#F8FBFF]',
    !disabled && activeClassName,
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex size-11 items-center justify-center rounded-2xl',
            disabled ? 'bg-slate-100' : 'bg-[#EAF4FF]',
          )}
        >
          <Icon
            className={cn('size-5', disabled ? 'text-slate-400' : 'text-[#2F80ED]')}
          />
        </div>
        {comingSoon ? (
          <span className="rounded-full bg-slate-200/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Coming soon
          </span>
        ) : null}
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        <p className={cn('mt-1 text-sm', disabled ? 'text-slate-400' : 'text-slate-500')}>
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

export default function WorkerVehiclesPage() {
  const {
    worker,
    isLoading: workerLoading,
    error: workerError,
    reload: reloadWorker,
  } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [isSavingDefault, setIsSavingDefault] = useState(false)
  const [defaultMessage, setDefaultMessage] = useState<string | null>(null)
  const [defaultError, setDefaultError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (companyLoading || workerLoading) return

      if (!companyReady || !worker) {
        setVehicles([])
        setIsLoadingVehicles(false)
        setLoadError(membershipError ?? workerError)
        return
      }

      setIsLoadingVehicles(true)
      setLoadError(null)

      try {
        const rows = await fetchVehicles()
        if (cancelled) return
        setVehicles(rows)

        const preferredId =
          worker.defaultVehicleId &&
          rows.some((vehicle) => vehicle.id === worker.defaultVehicleId)
            ? worker.defaultVehicleId
            : null
        setSelectedVehicleId((current) => {
          if (current && rows.some((vehicle) => vehicle.id === current)) return current
          return preferredId
        })
      } catch (error) {
        if (cancelled) return
        setVehicles([])
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load vehicles.',
        )
      } finally {
        if (!cancelled) setIsLoadingVehicles(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    companyLoading,
    companyReady,
    membershipError,
    worker,
    workerError,
    workerLoading,
  ])

  const selectedVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? null

  const defaultVehicle =
    (worker?.defaultVehicleId
      ? vehicles.find((vehicle) => vehicle.id === worker.defaultVehicleId)
      : null) ?? null

  const isSelectedDefault =
    Boolean(selectedVehicle) &&
    selectedVehicle?.id === worker?.defaultVehicleId

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
        `${selectedVehicle.registration || 'Vehicle'} saved as your default.`,
      )
    } catch (error) {
      setDefaultError(
        error instanceof DriversServiceError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Unable to save your default vehicle.',
      )
    } finally {
      setIsSavingDefault(false)
    }
  }

  if (workerLoading || companyLoading || isLoadingVehicles) {
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

      {defaultVehicle ? (
        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/50">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Your default vehicle
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {defaultVehicle.registration || 'No registration'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {[defaultVehicle.make, defaultVehicle.model].filter(Boolean).join(' ') ||
              'Vehicle'}
            {defaultVehicle.fleetNumber
              ? ` · Fleet ${defaultVehicle.fleetNumber}`
              : ''}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedVehicleId(defaultVehicle.id)
              setDefaultError(null)
            }}
            className="mt-3 text-sm font-semibold text-[#2F80ED]"
          >
            Use this vehicle
          </button>
        </section>
      ) : null}

      {loadError ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </p>
      ) : null}

      <WorkerVehicleCombobox
        vehicles={vehicles}
        selectedVehicleId={selectedVehicleId}
        onSelect={(vehicle) => {
          setSelectedVehicleId(vehicle?.id ?? null)
          setDefaultError(null)
          setDefaultMessage(null)
        }}
        label="Search registration"
        showAllWhenEmpty
      />

      {selectedVehicle ? (
        <section className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Selected vehicle
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {selectedVehicle.registration || 'No registration'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ') ||
              'Vehicle'}
          </p>

          <button
            type="button"
            disabled={isSavingDefault || isSelectedDefault}
            onClick={() => void handleSaveDefault()}
            className={cn(
              'mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-colors',
              isSelectedDefault
                ? 'cursor-default bg-emerald-50 text-emerald-700'
                : 'bg-[#2F80ED] text-white hover:bg-[#2563EB] disabled:opacity-60',
            )}
          >
            {isSavingDefault ? <Loader2 className="size-4 animate-spin" /> : null}
            {isSelectedDefault ? 'Saved as your default' : 'Save as my default vehicle'}
          </button>

          {defaultMessage ? (
            <p className="mt-2 text-sm font-medium text-emerald-700">{defaultMessage}</p>
          ) : null}
          {defaultError ? (
            <p className="mt-2 text-sm font-medium text-rose-600">{defaultError}</p>
          ) : null}
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
          Select a vehicle from the search results to continue. Typed registrations that
          are not in your company fleet cannot be used.
        </p>
      )}

      <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <VehicleActionCard
          title="Start Vehicle Check"
          description="Walkaround check for the selected vehicle."
          icon={ClipboardCheck}
          disabled={!selectedVehicle}
          to={vehicleHref('/worker/vehicle-checks', selectedVehicleId)}
        />
        <VehicleActionCard
          title="Start Tyre Check"
          description="Tyre inspection workflow."
          icon={CircleDot}
          disabled={!selectedVehicle}
          to={vehicleHref('/worker/tyre-checks/new', selectedVehicleId)}
        />
        <VehicleActionCard
          title="Add Consumable"
          description="Record fuel, AdBlue or other consumables."
          icon={Fuel}
          disabled={!selectedVehicle}
          to={vehicleHref('/worker/consumables', selectedVehicleId)}
        />
        <VehicleActionCard
          title="Create Driver Report"
          description="Report a defect or operational issue."
          icon={FileWarning}
          disabled={!selectedVehicle}
          to={vehicleHref('/worker/driver-reports', selectedVehicleId)}
          activeClassName="active:border-[#BFDFFF] active:bg-[#F8FBFF]"
        />
      </section>
    </div>
  )
}
