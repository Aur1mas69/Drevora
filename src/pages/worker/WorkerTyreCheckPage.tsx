import { AxleLayoutEditor } from '@/components/vehicle-checks/AxleLayoutEditor'
import { TyreCheckDiagram } from '@/components/vehicle-checks/TyreCheckDiagram'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { WorkerExitVehicleCheckDialog } from '@/components/worker/WorkerExitVehicleCheckDialog'
import { WorkerVehicleCombobox } from '@/components/worker/WorkerVehicleCombobox'
import { useCompanyTenantGate } from '@/hooks/useCompanyTenantGate'
import { useCurrentWorker } from '@/hooks/useCurrentWorker'
import { useWorkerVehicleCheckExitGuard } from '@/hooks/useWorkerVehicleCheckExitGuard'
import {
  DEFAULT_TRAILER_AXLE_COUNT,
  DEFAULT_TRUCK_AXLE_COUNT,
  MAX_COMBINED_TYRE_AXLES,
  parseTyreTreadDepthMm,
  resizeAxleWheelLayouts,
  resolveFallbackTrailerAxleWheelLayouts,
  resolveFallbackTruckAxleWheelLayouts,
  sortTyresForClockwiseWalk,
  totalAxleCount,
  trailerAxleOptions,
  treadDepthBand,
  treadDepthToStatus,
  truckAxleOptions,
  tyreStatusClasses,
  tyreStatusLabel,
  validateTyreAxleCounts,
  type AxleWheelLayout,
  type TyreMeasurement,
  type WorkerTyreCheckDraft,
} from '@/lib/tyreCheckTypes'
import { cn } from '@/lib/utils'
import {
  createWorkerTyreCheck,
  submitWorkerTyreCheck,
  TyreChecksServiceError,
  updateWorkerTyreCheckItem,
} from '@/services/tyreChecksService'
import { fetchVehicleTyreLayout, saveVehicleTyreLayout } from '@/services/vehicleTyreLayoutsService'
import { fetchVehicles, type Vehicle } from '@/services/vehiclesService'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

type FlowStep = 'setup' | 'inspect' | 'review' | 'done'

function isTrailerVehicle(vehicle: Vehicle): boolean {
  const type = vehicle.vehicleType?.toLowerCase() ?? ''
  return type.includes('trailer') || type.includes('low loader')
}

function vehicleLabel(vehicle: Vehicle): string {
  return (
    vehicle.registration?.trim() ||
    vehicle.fleetNumber?.trim() ||
    vehicle.id.slice(0, 8)
  )
}

/** Apply clockwise walk order so Next/Previous follow the physical walkaround. */
function withClockwiseWalkItems(draft: WorkerTyreCheckDraft): WorkerTyreCheckDraft {
  return {
    ...draft,
    items: sortTyresForClockwiseWalk(draft.items),
  }
}

function formatStartedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function formatDuration(seconds: number | null, startedAt: string): string {
  if (seconds != null && Number.isFinite(seconds) && seconds >= 0) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }
  const started = new Date(startedAt).getTime()
  if (Number.isNaN(started)) return '—'
  const elapsed = Math.max(0, Math.round((Date.now() - started) / 1000))
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return `${mins}m ${secs}s`
}

export default function WorkerTyreCheckPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { worker, isLoading: workerLoading, error: workerError } = useCurrentWorker()
  const { companyReady, companyLoading, membershipError } = useCompanyTenantGate()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehiclesLoading, setVehiclesLoading] = useState(true)
  const [vehiclesError, setVehiclesError] = useState<string | null>(null)

  const [step, setStep] = useState<FlowStep>('setup')
  const [vehicleId, setVehicleId] = useState(searchParams.get('vehicleId')?.trim() || '')
  const [trailerId, setTrailerId] = useState('')
  const [truckAxleCount, setTruckAxleCount] = useState(DEFAULT_TRUCK_AXLE_COUNT)
  const [trailerAxleCount, setTrailerAxleCount] = useState<number | null>(null)
  const [truckAxleLayouts, setTruckAxleLayouts] = useState<AxleWheelLayout[]>(() =>
    resolveFallbackTruckAxleWheelLayouts(DEFAULT_TRUCK_AXLE_COUNT),
  )
  const [trailerAxleLayouts, setTrailerAxleLayouts] = useState<AxleWheelLayout[]>(() =>
    resolveFallbackTrailerAxleWheelLayouts(DEFAULT_TRAILER_AXLE_COUNT),
  )
  const [odometer, setOdometer] = useState('')
  const [odometerUnit, setOdometerUnit] = useState<'miles' | 'km'>('miles')

  const [draft, setDraft] = useState<WorkerTyreCheckDraft | null>(null)
  const [tyreIndex, setTyreIndex] = useState(0)
  const [depthInput, setDepthInput] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [hasDefect, setHasDefect] = useState(false)
  const [defectNotes, setDefectNotes] = useState('')
  const [itemNotes, setItemNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submitLockRef = useRef(false)
  /** Apply URL / saved default at most once after vehicles load — never re-lock the picker. */
  const didInitVehicleRef = useRef(false)

  const tractorVehicles = useMemo(
    () => vehicles.filter((vehicle) => !isTrailerVehicle(vehicle)),
    [vehicles],
  )
  const trailerVehicles = useMemo(
    () =>
      vehicles.filter(
        (vehicle) => isTrailerVehicle(vehicle) && Boolean(vehicle.trailerNumber?.trim()),
      ),
    [vehicles],
  )

  const hasTrailer = Boolean(trailerId)
  const truckOptions = truckAxleOptions(hasTrailer ? trailerAxleCount : null)
  const trailerOptions = trailerAxleOptions(truckAxleCount)
  const combinedAxles = totalAxleCount(truckAxleCount, hasTrailer ? trailerAxleCount : null)

  const currentTyre = draft?.items[tyreIndex] ?? null
  const selectedVehicle =
    tractorVehicles.find((vehicle) => vehicle.id === (draft?.vehicleId || vehicleId)) ?? null
  const setupSelectedVehicle =
    tractorVehicles.find((vehicle) => vehicle.id === vehicleId) ?? null
  const selectedTrailer =
    trailerVehicles.find(
      (vehicle) => vehicle.id === (draft?.trailerVehicleId || trailerId),
    ) ?? null

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (companyLoading || workerLoading) return
      if (!companyReady || !worker) {
        setVehicles([])
        setVehiclesLoading(false)
        return
      }

      setVehiclesLoading(true)
      setVehiclesError(null)
      try {
        const rows = await fetchVehicles()
        if (cancelled) return
        setVehicles(rows)

        // Optional initial selection only: route vehicleId, else a valid saved
        // default. Never invent a selection from the first tractor, and never
        // re-apply after the Worker has changed or cleared the picker.
        if (!didInitVehicleRef.current) {
          didInitVehicleRef.current = true
          const fromUrl = searchParams.get('vehicleId')?.trim() || ''
          const fromDefault = worker.defaultVehicleId?.trim() || ''
          const candidate = fromUrl || fromDefault
          const isValidTractor = Boolean(
            candidate &&
              rows.some(
                (row) => row.id === candidate && !isTrailerVehicle(row),
              ),
          )
          if (isValidTractor) {
            setVehicleId(candidate)
          }
        }
      } catch (loadError) {
        if (cancelled) return
        setVehiclesError(
          loadError instanceof Error ? loadError.message : 'Unable to load vehicles.',
        )
      } finally {
        if (!cancelled) setVehiclesLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyLoading, companyReady, searchParams, worker, workerLoading])

  // Load the Vehicle's saved default layout when the selected truck changes.
  // Falls back silently to the existing default layout when nothing is saved
  // yet, or the RPC/table is unavailable — the Worker can still adjust and
  // start the inspection either way.
  useEffect(() => {
    if (!vehicleId || step !== 'setup') return
    let cancelled = false

    async function loadSavedLayout() {
      try {
        const saved = await fetchVehicleTyreLayout(vehicleId)
        if (cancelled || !saved || saved.axleLayouts.length === 0) return
        const nextCount = Math.min(MAX_COMBINED_TYRE_AXLES, Math.max(1, saved.axleCount))
        setTruckAxleCount(nextCount)
        setTruckAxleLayouts(
          resizeAxleWheelLayouts(saved.axleLayouts, nextCount, resolveFallbackTruckAxleWheelLayouts),
        )
      } catch {
        // Non-fatal: keep the current default layout.
      }
    }

    void loadSavedLayout()
    return () => {
      cancelled = true
    }
  }, [vehicleId, step])

  useEffect(() => {
    if (!hasTrailer || !trailerId || step !== 'setup') return
    let cancelled = false

    async function loadSavedTrailerLayout() {
      try {
        const saved = await fetchVehicleTyreLayout(trailerId)
        if (cancelled || !saved || saved.axleLayouts.length === 0) return
        const nextCount = Math.min(MAX_COMBINED_TYRE_AXLES, Math.max(1, saved.axleCount))
        setTrailerAxleCount(nextCount)
        setTrailerAxleLayouts(
          resizeAxleWheelLayouts(saved.axleLayouts, nextCount, resolveFallbackTrailerAxleWheelLayouts),
        )
      } catch {
        // Non-fatal: keep the current default layout.
      }
    }

    void loadSavedTrailerLayout()
    return () => {
      cancelled = true
    }
  }, [trailerId, hasTrailer, step])

  useEffect(() => {
    if (!currentTyre || step !== 'inspect') return
    setDepthInput(
      currentTyre.treadDepthMm == null ? '' : String(currentTyre.treadDepthMm),
    )
    setIsDirty(Boolean(currentTyre.isDirty))
    setHasDefect(Boolean(currentTyre.hasDefect))
    setDefectNotes(currentTyre.defectNotes ?? '')
    setItemNotes(currentTyre.notes ?? '')
  }, [currentTyre, step, tyreIndex])

  function handleTrailerChange(nextTrailerId: string) {
    setTrailerId(nextTrailerId)
    if (nextTrailerId) {
      setTruckAxleCount(DEFAULT_TRUCK_AXLE_COUNT)
      setTruckAxleLayouts(resolveFallbackTruckAxleWheelLayouts(DEFAULT_TRUCK_AXLE_COUNT))
      setTrailerAxleCount(DEFAULT_TRAILER_AXLE_COUNT)
      setTrailerAxleLayouts(resolveFallbackTrailerAxleWheelLayouts(DEFAULT_TRAILER_AXLE_COUNT))
      return
    }
    setTrailerAxleCount(null)
  }

  function syncLocalItem(updated: TyreMeasurement) {
    setDraft((current) => {
      if (!current) return current
      const items = current.items.map((item) =>
        item.dbItemId === updated.dbItemId || item.id === updated.id ? updated : item,
      )
      const goodCount = items.filter((item) => treadDepthBand(item.treadDepthMm) === 'good').length
      const attentionCount = items.filter(
        (item) => treadDepthBand(item.treadDepthMm) === 'attention',
      ).length
      const criticalCount = items.filter(
        (item) => treadDepthBand(item.treadDepthMm) === 'critical',
      ).length
      const dirtyCount = items.filter((item) => item.isDirty).length
      const defectCount = items.filter((item) => item.hasDefect).length
      const notCheckedCount = items.filter((item) => item.treadDepthMm == null).length
      return {
        ...current,
        items,
        goodCount,
        attentionCount,
        criticalCount,
        dirtyCount,
        defectCount,
        notCheckedCount,
      }
    })
  }

  async function handleStart() {
    if (!worker) {
      setError('Worker profile is required.')
      return
    }
    if (!vehicleId) {
      setError('Select a vehicle to continue.')
      return
    }

    const axleError = validateTyreAxleCounts(
      truckAxleCount,
      hasTrailer ? trailerAxleCount : null,
    )
    if (axleError) {
      setError(axleError)
      return
    }

    const odometerValue = Number.parseInt(odometer, 10)
    if (!Number.isFinite(odometerValue) || odometerValue < 0) {
      setError('Enter a valid odometer reading.')
      return
    }

    if (hasTrailer) {
      const trailer = trailerVehicles.find((vehicle) => vehicle.id === trailerId)
      if (!trailer?.trailerNumber?.trim()) {
        setError('Selected trailer needs a trailer number before inspection.')
        return
      }
    }

    setBusy(true)
    setError(null)
    try {
      // Persist the chosen layout as this Vehicle's default for future
      // checks. Best-effort: a save failure never blocks starting the
      // inspection — the check's own items remain the source of truth.
      try {
        await saveVehicleTyreLayout(vehicleId, truckAxleLayouts)
      } catch {
        // Non-fatal.
      }
      if (hasTrailer && trailerId) {
        try {
          await saveVehicleTyreLayout(trailerId, trailerAxleLayouts)
        } catch {
          // Non-fatal.
        }
      }

      const created = await createWorkerTyreCheck({
        workerId: worker.id,
        vehicleId,
        trailerVehicleId: hasTrailer ? trailerId : null,
        truckAxleCount,
        trailerAxleCount: hasTrailer ? trailerAxleCount : null,
        odometer: odometerValue,
        odometerUnit,
        truckAxleLayouts,
        trailerAxleLayouts: hasTrailer ? trailerAxleLayouts : null,
      })
      setDraft(withClockwiseWalkItems(created))
      setTyreIndex(0)
      setStep('inspect')
    } catch (startError) {
      setError(
        startError instanceof TyreChecksServiceError
          ? startError.message
          : startError instanceof Error
            ? startError.message
            : 'Unable to start tyre check.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function saveCurrentTyre(options?: { advance?: boolean; goToReview?: boolean }) {
    if (!draft || !currentTyre?.dbItemId) {
      setError('Tyre check is not ready.')
      return false
    }

    const parsed = parseTyreTreadDepthMm(depthInput)
    if (!parsed.ok) {
      setError(parsed.error)
      return false
    }
    if (parsed.value == null) {
      setError('Enter tread depth before saving this tyre.')
      return false
    }
    if (hasDefect && !defectNotes.trim()) {
      setError('Defect notes are required when Defect is selected.')
      return false
    }

    setBusy(true)
    setError(null)
    try {
      const updated = await updateWorkerTyreCheckItem(currentTyre.dbItemId, {
        treadDepthMm: parsed.value,
        isDirty,
        hasDefect,
        defectNotes,
        notes: itemNotes,
      })
      syncLocalItem(updated)

      if (options?.goToReview) {
        setStep('review')
      } else if (options?.advance) {
        setTyreIndex((index) => Math.min(index + 1, Math.max(0, (draft.items.length || 1) - 1)))
      }
      return true
    } catch (saveError) {
      setError(
        saveError instanceof TyreChecksServiceError
          ? saveError.message
          : saveError instanceof Error
            ? saveError.message
            : 'Unable to save tyre reading.',
      )
      return false
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    if (!draft || submitLockRef.current) return
    const unchecked = draft.items.filter((item) => item.treadDepthMm == null)
    if (unchecked.length > 0) {
      setError(`Submit blocked: ${unchecked.length} tyre(s) still unchecked.`)
      return
    }
    const missingDefectNotes = draft.items.filter(
      (item) => item.hasDefect && !item.defectNotes?.trim(),
    )
    if (missingDefectNotes.length > 0) {
      setError('Add defect notes for every Defect tyre before submit.')
      return
    }

    submitLockRef.current = true
    setBusy(true)
    setError(null)
    try {
      const submitted = await submitWorkerTyreCheck(draft.checkId)
      setDraft(withClockwiseWalkItems(submitted))
      setStep('done')
    } catch (submitError) {
      setError(
        submitError instanceof TyreChecksServiceError
          ? submitError.message
          : submitError instanceof Error
            ? submitError.message
            : 'Unable to submit tyre check.',
      )
      submitLockRef.current = false
    } finally {
      setBusy(false)
    }
  }

  const discardActiveCheckToSetup = useCallback(() => {
    setDraft(null)
    setTyreIndex(0)
    setDepthInput('')
    setIsDirty(false)
    setHasDefect(false)
    setDefectNotes('')
    setItemNotes('')
    setError(null)
    submitLockRef.current = false
    setStep('setup')
  }, [])

  const {
    exitOpen,
    handleContinueCheck,
    handleExitCheck,
    requestExitToSetup,
  } = useWorkerVehicleCheckExitGuard({
    // Active only after start and before successful submit.
    isCheckActive: step === 'inspect' || step === 'review',
    onDiscardToSetup: discardActiveCheckToSetup,
  })

  if (companyLoading || workerLoading || vehiclesLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading tyre check…
      </div>
    )
  }

  if (membershipError || workerError || vehiclesError) {
    return (
      <div className="space-y-3 rounded-[1.5rem] border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
        <p>{membershipError || workerError || vehiclesError}</p>
        <Link to="/worker/vehicles" className="font-semibold text-[#2F80ED]">
          Back to Vehicles
        </Link>
      </div>
    )
  }

  if (!worker) {
    return (
      <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 text-sm text-slate-600">
        Worker profile required.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (step === 'inspect') {
              requestExitToSetup()
              return
            }
            if (step === 'review') {
              setStep('inspect')
              return
            }
            navigate('/worker/vehicles')
          }}
          className="flex size-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">Tyre Check</h1>
          <p className="text-sm text-slate-500">
            {step === 'setup'
              ? 'Select vehicle and start inspection'
              : step === 'inspect'
                ? `Tyre ${tyreIndex + 1} of ${draft?.items.length ?? 0}`
                : step === 'review'
                  ? 'Review before submit'
                  : 'Submitted'}
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {step === 'setup' ? (
        <section className="space-y-4 overflow-visible rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
          {setupSelectedVehicle ? (
            <div className="rounded-2xl border border-[#C5DFFB] bg-[#F5FAFF] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Selected vehicle
                  </p>
                  <p className="mt-1 text-base font-semibold text-slate-950">
                    {vehicleLabel(setupSelectedVehicle)}
                  </p>
                  {([setupSelectedVehicle.make, setupSelectedVehicle.model]
                    .filter(Boolean)
                    .join(' ') || null) && (
                    <p className="mt-0.5 text-sm text-slate-500">
                      {[setupSelectedVehicle.make, setupSelectedVehicle.model]
                        .filter(Boolean)
                        .join(' ')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVehicleId('')
                    setError(null)
                    window.setTimeout(() => {
                      document.getElementById('worker-tyre-check-vehicle')?.focus()
                    }, 0)
                  }}
                  aria-label={`Remove selected vehicle ${vehicleLabel(setupSelectedVehicle)}`}
                  className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Search and select an active company vehicle to continue. A saved
              default is optional.
            </p>
          )}

          <WorkerVehicleCombobox
            id="worker-tyre-check-vehicle"
            vehicles={tractorVehicles}
            selectedVehicleId={vehicleId || null}
            onSelect={(vehicle) => {
              setVehicleId(vehicle.id)
              setError(null)
            }}
            onClear={() => {
              setVehicleId('')
              setError(null)
            }}
            label="Search registration"
            placeholder="Enter registration number"
            inputAriaLabel="Search company vehicles by registration number"
            required
            showAllWhenEmpty
            showSelectedSummary={false}
          />

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Trailer (optional)
            </span>
            <select
              value={trailerId}
              onChange={(event) => handleTrailerChange(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900"
            >
              <option value="">No trailer</option>
              {trailerVehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle)}
                  {vehicle.trailerNumber ? ` · ${vehicle.trailerNumber}` : ''}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Only trailers with a trailer number can be selected.
            </p>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Truck axles
              </span>
              <select
                value={truckAxleCount}
                onChange={(event) => {
                  const next = Number(event.target.value)
                  setTruckAxleCount(next)
                  setTruckAxleLayouts((current) =>
                    resizeAxleWheelLayouts(current, next, resolveFallbackTruckAxleWheelLayouts),
                  )
                  if (hasTrailer && trailerAxleCount != null) {
                    const maxTrailer = MAX_COMBINED_TYRE_AXLES - next
                    if (trailerAxleCount > maxTrailer) {
                      const nextTrailerCount = Math.max(1, maxTrailer)
                      setTrailerAxleCount(nextTrailerCount)
                      setTrailerAxleLayouts((current) =>
                        resizeAxleWheelLayouts(
                          current,
                          nextTrailerCount,
                          resolveFallbackTrailerAxleWheelLayouts,
                        ),
                      )
                    }
                  }
                }}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
              >
                {truckOptions.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>

            {hasTrailer ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Trailer axles
                </span>
                <select
                  value={trailerAxleCount ?? DEFAULT_TRAILER_AXLE_COUNT}
                  onChange={(event) => {
                    const next = Number(event.target.value)
                    setTrailerAxleCount(next)
                    setTrailerAxleLayouts((current) =>
                      resizeAxleWheelLayouts(current, next, resolveFallbackTrailerAxleWheelLayouts),
                    )
                  }}
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                >
                  {trailerOptions.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="flex items-end">
                <p className="rounded-2xl border border-[#D3E9FC] bg-[#F8FBFF] px-3 py-3 text-xs font-semibold text-[#0B68BE]">
                  Total axles {combinedAxles} / {MAX_COMBINED_TYRE_AXLES}
                </p>
              </div>
            )}
          </div>

          {hasTrailer ? (
            <p className="text-xs font-semibold text-[#0B68BE]">
              Total axles {combinedAxles} / {MAX_COMBINED_TYRE_AXLES}
            </p>
          ) : null}

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              Truck axle layout
            </span>
            <AxleLayoutEditor
              unitLabel="Truck"
              axleLayouts={truckAxleLayouts}
              onChange={setTruckAxleLayouts}
              compact
            />
          </div>

          {hasTrailer ? (
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Trailer axle layout
              </span>
              <AxleLayoutEditor
                unitLabel="Trailer"
                axleLayouts={trailerAxleLayouts}
                onChange={setTrailerAxleLayouts}
                compact
              />
            </div>
          ) : null}

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Odometer
              </span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={odometer}
                onChange={(event) => setOdometer(event.target.value)}
                className="h-12 rounded-2xl"
                placeholder="e.g. 124850"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                Unit
              </span>
              <select
                value={odometerUnit}
                onChange={(event) =>
                  setOdometerUnit(event.target.value === 'km' ? 'km' : 'miles')
                }
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
              >
                <option value="miles">miles</option>
                <option value="km">km</option>
              </select>
            </label>
          </div>

          <Button
            type="button"
            className="h-12 w-full rounded-2xl bg-[#2563EB] text-base font-semibold text-white hover:bg-[#1d4ed8]"
            disabled={busy || !vehicleId}
            onClick={() => void handleStart()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Start inspection
          </Button>
        </section>
      ) : null}

      {step === 'inspect' && draft && currentTyre ? (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
              Progress
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--worker-text)]">
              Tyre {tyreIndex + 1} of {draft.items.length} · {currentTyre.axleLabel}
            </p>
            <div className="mt-3 overflow-x-auto pb-2">
              <div className="min-w-[18rem] px-1.5 py-2">
                <TyreCheckDiagram
                  measurements={draft.items.map((item) => ({
                    ...item,
                    status: treadDepthToStatus(item.treadDepthMm, Boolean(item.isDirty)),
                  }))}
                  selectedTyreId={currentTyre.id}
                  emphasizeSelection
                  onSelectTyre={(tyreId) => {
                    const nextIndex = draft.items.findIndex((item) => item.id === tyreId)
                    if (nextIndex >= 0) setTyreIndex(nextIndex)
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-[1.5rem] border border-[color:var(--worker-border)] bg-[color:var(--worker-card)] p-4 shadow-sm">
            <div>
              <p className="text-lg font-semibold text-[color:var(--worker-text)]">
                {currentTyre.axleLabel} · {currentTyre.position}
              </p>
              <p className="mt-1 text-xs text-[color:var(--worker-text-secondary)]">
                Thresholds: Good ≥ 6.0 mm · Attention 4.0–5.9 mm · Critical &lt; 4.0 mm
              </p>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                Tread depth (mm)
              </span>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={30}
                step={0.5}
                value={depthInput}
                onChange={(event) => setDepthInput(event.target.value)}
                className="h-14 rounded-2xl border-[color:var(--worker-border)] bg-[color:var(--worker-input)] text-lg font-bold text-[color:var(--worker-text)] placeholder:text-[color:var(--worker-text-muted)]"
                placeholder="e.g. 7.5"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsDirty((value) => !value)}
                className={cn(
                  'min-h-12 rounded-2xl border-2 text-sm font-extrabold transition active:scale-[0.97]',
                  isDirty
                    ? 'border-yellow-800 bg-yellow-400 text-yellow-950 ring-4 ring-yellow-300'
                    : 'border-yellow-700 bg-yellow-100 text-yellow-950',
                )}
                aria-pressed={isDirty}
              >
                Dirty / mud
              </button>
              <button
                type="button"
                onClick={() => setHasDefect((value) => !value)}
                className={cn(
                  'min-h-12 rounded-2xl border-2 text-sm font-extrabold transition active:scale-[0.97]',
                  hasDefect
                    ? 'border-red-950 bg-red-600 text-white ring-4 ring-red-300'
                    : 'border-red-700 bg-red-100 text-red-950',
                )}
                aria-pressed={hasDefect}
              >
                Defect
              </button>
            </div>

            {hasDefect ? (
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                  Defect notes (required)
                </span>
                <textarea
                  value={defectNotes}
                  onChange={(event) => setDefectNotes(event.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-3 py-2 text-sm text-[color:var(--worker-text)] placeholder:text-[color:var(--worker-text-muted)]"
                  placeholder="Describe the defect…"
                />
              </label>
            ) : null}

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--worker-text-muted)]">
                Notes (optional)
              </span>
              <textarea
                value={itemNotes}
                onChange={(event) => setItemNotes(event.target.value)}
                rows={2}
                className="w-full rounded-2xl border border-[color:var(--worker-border)] bg-[color:var(--worker-input)] px-3 py-2 text-sm text-[color:var(--worker-text)] placeholder:text-[color:var(--worker-text-muted)]"
                placeholder="Optional tyre notes"
              />
            </label>

            <p className="text-xs text-[color:var(--worker-text-muted)]">
              Photos are not available yet for Tyre Checks (storage bucket pending).
            </p>

            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-[color:var(--worker-border-strong)] bg-[color:var(--worker-elevated)] font-semibold text-[color:var(--worker-text)] hover:bg-[color:var(--worker-row-hover)] hover:text-[color:var(--worker-text)] disabled:opacity-40"
                disabled={busy || tyreIndex === 0}
                onClick={() => setTyreIndex((index) => Math.max(0, index - 1))}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <Button
                type="button"
                className="h-12 rounded-2xl bg-[#4344F6] font-semibold text-white hover:bg-[#3536D4]"
                disabled={busy}
                onClick={() => {
                  if (tyreIndex >= draft.items.length - 1) {
                    void saveCurrentTyre({ goToReview: true })
                  } else {
                    void saveCurrentTyre({ advance: true })
                  }
                }}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                {tyreIndex >= draft.items.length - 1 ? 'Save' : 'Save & Next'}
                {tyreIndex < draft.items.length - 1 ? (
                  <ChevronRight className="size-4" />
                ) : null}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl border-[color:var(--worker-border-strong)] bg-[color:var(--worker-elevated)] font-semibold text-[color:var(--worker-text)] hover:bg-[color:var(--worker-row-hover)] hover:text-[color:var(--worker-text)] disabled:opacity-40"
                disabled={busy}
                onClick={() => void saveCurrentTyre({ goToReview: true })}
              >
                Review
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      {step === 'review' && draft ? (
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Review summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Vehicle</dt>
                <dd className="font-semibold text-slate-900">
                  {selectedVehicle ? vehicleLabel(selectedVehicle) : draft.vehicleId}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Trailer</dt>
                <dd className="font-semibold text-slate-900">
                  {selectedTrailer ? vehicleLabel(selectedTrailer) : 'None'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Worker</dt>
                <dd className="font-semibold text-slate-900">
                  {worker.firstName} {worker.lastName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Started</dt>
                <dd className="font-semibold text-slate-900">
                  {formatStartedAt(draft.inspectionStartedAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Duration</dt>
                <dd className="font-semibold text-slate-900">
                  {formatDuration(draft.durationSeconds, draft.inspectionStartedAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Odometer</dt>
                <dd className="font-semibold text-slate-900">
                  {draft.odometer} {draft.odometerUnit}
                </dd>
              </div>
            </dl>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ['Good', draft.goodCount, 'good'],
                  ['Attention', draft.attentionCount, 'attention'],
                  ['Critical', draft.criticalCount, 'critical'],
                  ['Dirty', draft.dirtyCount, 'dirty'],
                  ['Defect', draft.defectCount, 'critical'],
                  ['Not checked', draft.notCheckedCount, 'not_checked'],
                ] as const
              ).map(([label, value, tone]) => {
                const colours = tyreStatusClasses(tone)
                return (
                  <div
                    key={label}
                    className={cn('rounded-2xl border-2 px-3 py-3', colours.tile)}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] opacity-90">
                      {label}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {draft.notCheckedCount > 0 ? (
            <div className="flex items-start gap-2 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Submit is blocked until every tyre has a tread depth.
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-[color:var(--worker-border-strong)] bg-[color:var(--worker-elevated)] font-semibold text-[color:var(--worker-text)] hover:bg-[color:var(--worker-row-hover)] hover:text-[color:var(--worker-text)]"
              disabled={busy}
              onClick={() => setStep('inspect')}
            >
              Back to tyres
            </Button>
            <Button
              type="button"
              className="h-12 rounded-2xl bg-[#4344F6] font-semibold text-white hover:bg-[#3536D4]"
              disabled={busy || draft.notCheckedCount > 0}
              onClick={() => void handleSubmit()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit Tyre Check
            </Button>
          </div>
        </section>
      ) : null}

      {step === 'done' && draft ? (
        <section className="space-y-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-emerald-950">Tyre Check submitted</h2>
            <p className="mt-2 text-sm text-emerald-900/80">
              Saved to Supabase for Admin review. Result:{' '}
              <span className="font-bold">{draft.overallResult}</span>
            </p>
            {draft.durationSeconds != null ? (
              <p className="mt-1 text-sm text-emerald-900/80">
                Duration {formatDuration(draft.durationSeconds, draft.inspectionStartedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {(['good', 'attention', 'critical', 'dirty', 'not_checked'] as const).map(
              (status) => (
                <span
                  key={status}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold',
                    tyreStatusClasses(status).badge,
                  )}
                >
                  {tyreStatusLabel(status)}
                </span>
              ),
            )}
          </div>
          <Button
            type="button"
            className="h-12 w-full rounded-2xl bg-[#2563EB] font-semibold text-white"
            onClick={() => navigate('/worker/vehicles')}
          >
            Back to Vehicles
          </Button>
        </section>
      ) : null}

      <WorkerExitVehicleCheckDialog
        open={exitOpen}
        title="Exit Tyre Check?"
        message="Your Tyre Check is not completed. If you exit, your unsaved progress will be lost."
        onContinue={handleContinueCheck}
        onExit={handleExitCheck}
      />
    </div>
  )
}
