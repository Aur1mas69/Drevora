import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { cn } from '@/lib/utils'
import {
  fetchVehicles,
  type Vehicle,
} from '@/services/vehiclesService'
import {
  ClipboardCheck,
  CircleDot,
  FileWarning,
  Fuel,
  Search,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

function VehicleActionCard({
  title,
  description,
  icon: Icon,
  to,
  disabled,
  comingSoon,
}: {
  title: string
  description: string
  icon: typeof Truck
  to?: string
  disabled?: boolean
  comingSoon?: boolean
}) {
  const className = cn(
    'flex min-h-[5.5rem] w-full flex-col justify-between rounded-[1.5rem] border p-4 text-left shadow-sm transition-colors',
    disabled
      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
      : 'border-slate-100 bg-white text-slate-950 shadow-slate-200/60 hover:border-[#BFDFFF] hover:bg-[#F8FBFF]',
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

export default function WorkerVehiclesPage() {
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)

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
        setSelectedVehicleId((current) => current ?? preferredId)
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

  const filteredVehicles = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return vehicles
    return vehicles.filter((vehicle) => {
      const registration = vehicle.registration?.toLowerCase() ?? ''
      const fleet = vehicle.fleetNumber?.toLowerCase() ?? ''
      const make = vehicle.make?.toLowerCase() ?? ''
      const model = vehicle.model?.toLowerCase() ?? ''
      return (
        registration.includes(term) ||
        fleet.includes(term) ||
        make.includes(term) ||
        model.includes(term)
      )
    })
  }, [search, vehicles])

  const selectedVehicle =
    filteredVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
    null

  const defaultVehicle =
    (worker?.defaultVehicleId
      ? vehicles.find((vehicle) => vehicle.id === worker.defaultVehicleId)
      : null) ?? null

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
          Choose a vehicle, then start a check or related action.
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
            onClick={() => setSelectedVehicleId(defaultVehicle.id)}
            className="mt-3 text-sm font-semibold text-[#2F80ED]"
          >
            Use this vehicle
          </button>
        </section>
      ) : null}

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Search registration
        </span>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter registration"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-slate-950 outline-none placeholder:text-slate-400 focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/20"
          />
        </div>
      </label>

      {loadError ? (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </p>
      ) : null}

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Select vehicle
        </p>
        <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {filteredVehicles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
              No vehicles match this search.
            </div>
          ) : (
            filteredVehicles.map((vehicle) => {
              const selected = vehicle.id === selectedVehicleId
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                    selected
                      ? 'border-[#2F80ED] bg-[#EAF4FF]'
                      : 'border-slate-100 bg-white hover:bg-slate-50',
                  )}
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#EAF4FF]">
                    <Truck className="size-4 text-[#2F80ED]" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">
                      {vehicle.registration || 'No registration'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {[vehicle.make, vehicle.model].filter(Boolean).join(' ') ||
                        'Vehicle'}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </section>

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
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <VehicleActionCard
          title="Start Vehicle Check"
          description="Walkaround check for the selected vehicle."
          icon={ClipboardCheck}
          to="/worker/vehicle-checks"
        />
        <VehicleActionCard
          title="Start Tyre Check"
          description="Tyre inspection workflow."
          icon={CircleDot}
          to={
            selectedVehicle
              ? `/worker/tyre-checks/new?vehicleId=${encodeURIComponent(selectedVehicle.id)}`
              : '/worker/tyre-checks/new'
          }
        />
        <VehicleActionCard
          title="Add Consumable"
          description="Record fuel, AdBlue or other consumables."
          icon={Fuel}
          to="/worker/consumables"
        />
        <VehicleActionCard
          title="Create Driver Report"
          description="Report a defect or operational issue."
          icon={FileWarning}
          to="/worker/driver-reports"
        />
      </section>
    </div>
  )
}
